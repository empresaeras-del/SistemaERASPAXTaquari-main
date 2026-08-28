import { supabase } from './supabase';
import { getFromIDB, saveToIDB, deleteFromIDB, getAllFromIDB } from './idb';
import { generateUUID } from '../utils/uuid';

export interface SyncTask {
  id: string;
  storeName: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  createdAt: string;
  retries?: number;
  lastError?: string;
}

const SYNC_QUEUE_STORE = 'sync_queue';
const MAX_RETRIES = 3;

const getSupabaseTableName = (storeName: string): string | null => {
  const map: Record<string, string> = {
    empresas: 'tenants',
    tenants: 'tenants',
    usuarios: 'users',
    users: 'users',
    associados: 'associados',
    dependentes: 'dependentes',
    planos_pax: 'planos_pax',
    itens_funerarios: 'itens_funerarios',
    credenciados: 'credenciados',
    procedimentos: 'procedimentos',
    credenciados_procedimentos: 'credenciados_procedimentos',
    credenciados_planos: 'credenciados_planos',
    receitas: 'receitas',
    despesas: 'despesas',
    parcelas_receber: 'parcelas_receber',
    parcelas_pagar: 'parcelas_pagar',
    lotes_caixa: 'lotes_caixa',
    movimentacoes_caixa: 'movimentacoes_caixa',
    requisicoes: 'requisicoes',
    requisicao_itens: 'requisicao_itens',
    remessas_faturamento: 'remessas_faturamento',
    contas_bancarias: 'contas_bancarias',
    fornecedores: 'fornecedores',
    atendimentos: 'atendimentos',
    atendimento_itens: 'atendimento_itens',
    auditoria: 'auditoria',
    notificacoes: 'notificacoes',
    documentos_padroes: 'documentos_padroes',
    contratos: 'contratos',
  };
  return map[storeName] || null;
};

export const addToSyncQueue = async (task: Omit<SyncTask, 'id' | 'createdAt' | 'retries'>) => {
  const newTask: SyncTask = {
    ...task,
    id: generateUUID(),
    createdAt: new Date().toISOString(),
    retries: 0
  };
  await saveToIDB(SYNC_QUEUE_STORE, newTask);
  window.dispatchEvent(new Event('sync_queue_updated'));
};

export const getSyncQueue = async (): Promise<SyncTask[]> => {
  try {
    return await getAllFromIDB<SyncTask>(SYNC_QUEUE_STORE);
  } catch (e) {
    return [];
  }
};

export const clearFailedSyncTasks = async () => {
  try {
    const queue = await getSyncQueue();
    for (const t of queue) {
      if ((t.retries || 0) >= MAX_RETRIES) {
        await deleteFromIDB(SYNC_QUEUE_STORE, t.id);
      }
    }
    window.dispatchEvent(new Event('sync_queue_updated'));
  } catch (e) {}
};

let isProcessing = false;

export const processSyncQueue = async (isOnline: boolean) => {
  if (!isOnline || isProcessing) return;

  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  isProcessing = true;
  window.dispatchEvent(new CustomEvent('sync_status_changed', { detail: { isSyncing: true } }));

  try {
    for (const task of queue) {
      const targetTable = getSupabaseTableName(task.storeName);

      // Se a storeName não mapear para nenhuma tabela do Supabase (ex: preferencias), apenas remove
      if (!targetTable) {
        await deleteFromIDB(SYNC_QUEUE_STORE, task.id);
        continue;
      }

      // Se excedeu o número de tentativas, remove para não travar o loop de sincronização
      if ((task.retries || 0) >= MAX_RETRIES) {
        console.warn(`Sync task ${task.id} (${task.storeName}) excedeu ${MAX_RETRIES} tentativas. Removendo da fila. Erro anterior:`, task.lastError);
        await deleteFromIDB(SYNC_QUEUE_STORE, task.id);
        continue;
      }

      try {
        if (task.action === 'insert' || task.action === 'update') {
          let payload = { ...task.data };

          // Sanitização específica para associados
          if (targetTable === 'associados') {
            const { dependentes, fornecedor_id, justificativa_modificacao_plano, ...assocClean } = payload;
            payload = assocClean;

            const { error: assocErr } = await supabase.from(targetTable).upsert(payload);
            if (assocErr) throw assocErr;

            // Se houver dependentes, sincroniza separadamente
            if (Array.isArray(dependentes) && dependentes.length > 0) {
              const depsPayload = dependentes.map((d: any) => ({
                id: d.id,
                associado_id: payload.id,
                tenant_id: payload.tenant_id,
                empresa_id: payload.tenant_id,
                nome: d.nome || '',
                cpf: d.cpf || null,
                data_nascimento: d.data_nascimento || null,
                parentesco: d.parentesco || 'Outro'
              }));
              await supabase.from('dependentes').upsert(depsPayload);
            }

            // Se houver plano, sincroniza também na tabela contratos
            if (payload.plano_pax_id) {
              try {
                const contratoPayload = {
                  id: generateUUID(),
                  tenant_id: payload.tenant_id || 'default_tenant',
                  empresa_id: payload.empresa_id || payload.tenant_id || 'default_tenant',
                  associado_id: payload.id,
                  plano_pax_id: payload.plano_pax_id,
                  numero_contrato: payload.numero_contrato || `CTR-${payload.id.substring(0, 8).toUpperCase()}`,
                  data_inicio: payload.data_adesao || new Date().toISOString().split('T')[0],
                  valor_mensalidade: payload.valor_plano || null,
                  status: payload.status || 'ativo',
                  observacoes: payload.observacoes || null
                };

                const { data: existingContrato } = await supabase
                  .from('contratos')
                  .select('id')
                  .eq('associado_id', payload.id)
                  .maybeSingle();

                if (existingContrato) {
                  await supabase.from('contratos').update(contratoPayload).eq('id', existingContrato.id);
                } else {
                  await supabase.from('contratos').insert(contratoPayload);
                }
              } catch (contratoErr) {
                console.warn('Erro ao sincronizar contrato na fila de sync:', contratoErr);
              }
            }
          } else {
            const { error } = await supabase.from(targetTable).upsert(payload);
            if (error) throw error;
          }
        } else if (task.action === 'delete') {
          const targetId = task.data?.id || task.data;
          try {
            if (targetTable === 'associados') {
              // a) Receitas e Parcelas a Receber
              const { data: recs } = await supabase.from('receitas').select('id').eq('associado_id', targetId);
              if (recs && recs.length > 0) {
                await supabase.from('parcelas_receber').delete().in('receita_id', recs.map(r => r.id));
                await supabase.from('receitas').delete().eq('associado_id', targetId);
              }

              // b) Atendimentos e Itens
              const { data: atends } = await supabase.from('atendimentos').select('id').eq('associado_id', targetId);
              if (atends && atends.length > 0) {
                await supabase.from('atendimento_itens').delete().in('atendimento_id', atends.map(a => a.id));
                await supabase.from('atendimentos').delete().eq('associado_id', targetId);
              }

              // c) Requisições e Itens
              const { data: reqs } = await supabase.from('requisicoes').select('id').eq('associado_id', targetId);
              if (reqs && reqs.length > 0) {
                await supabase.from('requisicao_itens').delete().in('requisicao_id', reqs.map(r => r.id));
                await supabase.from('requisicoes').delete().eq('associado_id', targetId);
              }

              // d) Dependentes e Contratos
              await supabase.from('dependentes').delete().eq('associado_id', targetId);
              await supabase.from('contratos').delete().eq('associado_id', targetId);

              // e) Associado
              const { error: delErr } = await supabase.from('associados').delete().eq('id', targetId);
              if (delErr) {
                await supabase.from('associados').update({ deleted_at: new Date().toISOString(), status: 'inativo' }).eq('id', targetId);
              }
            } else if (targetTable === 'planos_pax') {
              await supabase.from('planos_pax_coberturas').delete().eq('plano_id', targetId);
              await supabase.from('planos_pax_faixas').delete().eq('plano_id', targetId);
              await supabase.from('credenciados_planos').delete().eq('plano_id', targetId);
              const { error: delErr } = await supabase.from('planos_pax').delete().eq('id', targetId);
              if (delErr) {
                await supabase.from('planos_pax').update({ deleted_at: new Date().toISOString(), ativo: false }).eq('id', targetId);
              }
            } else if (targetTable === 'itens_funerarios') {
              await supabase.from('planos_pax_coberturas').delete().eq('item_id', targetId);
              const { error: delErr } = await supabase.from('itens_funerarios').delete().eq('id', targetId);
              if (delErr) {
                await supabase.from('itens_funerarios').update({ deleted_at: new Date().toISOString(), ativo: false }).eq('id', targetId);
              }
            } else if (targetTable === 'credenciados') {
              await supabase.from('credenciados_planos').delete().eq('credenciado_id', targetId);
              await supabase.from('credenciados_procedimentos').delete().eq('credenciado_id', targetId);
              const { error: delErr } = await supabase.from('credenciados').delete().eq('id', targetId);
              if (delErr) {
                await supabase.from('credenciados').update({ deleted_at: new Date().toISOString(), status: 'descredenciado' }).eq('id', targetId);
              }
            } else if (targetTable === 'fornecedores') {
              const { data: despesas } = await supabase.from('despesas').select('id').eq('fornecedor_id', targetId);
              if (despesas && despesas.length > 0) {
                await supabase.from('parcelas_pagar').delete().in('despesa_id', despesas.map(d => d.id));
                await supabase.from('despesas').delete().eq('fornecedor_id', targetId);
              }
              const { error: delErr } = await supabase.from('fornecedores').delete().eq('id', targetId);
              if (delErr) {
                await supabase.from('fornecedores').update({ deleted_at: new Date().toISOString(), status: 'inativo' }).eq('id', targetId);
              }
            } else if (targetTable === 'atendimentos') {
              await supabase.from('atendimento_itens').delete().eq('atendimento_id', targetId);
              await supabase.from('atendimentos').delete().eq('id', targetId);
            } else if (targetTable === 'requisicoes') {
              await supabase.from('requisicao_itens').delete().eq('requisicao_id', targetId);
              await supabase.from('requisicoes').delete().eq('id', targetId);
            } else if (targetTable === 'receitas') {
              await supabase.from('parcelas_receber').delete().eq('receita_id', targetId);
              await supabase.from('receitas').delete().eq('id', targetId);
            } else if (targetTable === 'despesas') {
              await supabase.from('parcelas_pagar').delete().eq('despesa_id', targetId);
              await supabase.from('despesas').delete().eq('id', targetId);
            } else if (targetTable === 'lotes_caixa') {
              await supabase.from('movimentacoes_caixa').delete().eq('lote_id', targetId);
              await supabase.from('lotes_caixa').delete().eq('id', targetId);
            } else {
              const { error } = await supabase.from(targetTable).update({ deleted_at: new Date().toISOString() }).eq('id', targetId);
              if (error) {
                const hardDelete = await supabase.from(targetTable).delete().eq('id', targetId);
                if (hardDelete.error) throw hardDelete.error;
              }
            }
          } catch (cascadeErr) {
            console.warn(`Erro ao processar exclusão em cascata na fila de sync (${targetTable}):`, cascadeErr);
          }
        }

        // Sucesso: remove da fila
        await deleteFromIDB(SYNC_QUEUE_STORE, task.id);
      } catch (error: any) {
        console.warn(`Falha na sincronização da tarefa ${task.id} (${targetTable}):`, error?.message || error);
        
        // Atualiza contador de retry e registra erro
        const updatedTask: SyncTask = {
          ...task,
          retries: (task.retries || 0) + 1,
          lastError: error?.message || String(error)
        };

        if (updatedTask.retries >= MAX_RETRIES) {
          // Se atingiu o limite, remove para evitar loop infinito
          await deleteFromIDB(SYNC_QUEUE_STORE, task.id);
        } else {
          await saveToIDB(SYNC_QUEUE_STORE, updatedTask);
        }
      }
    }
  } finally {
    isProcessing = false;
    window.dispatchEvent(new CustomEvent('sync_status_changed', { detail: { isSyncing: false } }));
    window.dispatchEvent(new Event('sync_queue_updated'));
  }
};
