import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';

export interface Associado {
  id: string;
  tenant_id: string;
  nome: string;
  cpf: string;
  data_nascimento?: string;
  rg?: string;
  sexo?: string;
  nome_pai?: string;
  nome_mae?: string;
  telefone?: string;
  email?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_cep?: string;
  plano_id?: string;
  tipo_pessoa?: 'PF' | 'PJ';
  fornecedor_id?: string;
  plano_pax_id?: string;
  numero_contrato?: string;
  n_vidas?: number;
  plano_nome?: string;
  documentos?: DocumentoAssociado[];
  valor_plano?: number;
  assinatura_base64?: string;
  historico_contratos?: { id: string; plano: string; valor: number; data_inicio: string; data_fim?: string }[];
  status: 'ativo' | 'inativo' | 'inadimplente' | 'encerrado';
  created_at?: string;
  deleted_at?: string | null;
  data_adesao: string;
  dependentes: Dependente[];
}

export interface Dependente {
  id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  parentesco: string;
}

const STORE_NAME = 'associados';

export const getAssociados = async (isOnline: boolean, tenantId: string | null): Promise<Associado[]> => {
  let associados: Associado[] = [];

  if (isOnline) {
    try {
      let data: any[] | null = null;

      // 1. Tenta buscar associados com dependentes em join
      try {
        let query = supabase
          .from('associados')
          .select('*, dependentes(*)')
          .is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
          query = query.eq('tenant_id', tenantId);
        }
        const res = await query;
        if (!res.error && res.data) {
          data = res.data;
        }
      } catch (e) {
        // Fallback para queries separadas
      }

      // 2. Se join não retornou, busca direto da tabela associados e anexa dependentes
      if (!data) {
        let query = supabase
          .from('associados')
          .select('*')
          .is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
          query = query.eq('tenant_id', tenantId);
        }
        const res = await query;
        if (res.error) throw res.error;
        const assocData = res.data || [];

        // Busca dependentes vinculados
        if (assocData.length > 0) {
          const assocIds = assocData.map(a => a.id);
          try {
            const { data: depsData } = await supabase
              .from('dependentes')
              .select('*')
              .in('associado_id', assocIds);
            
            const depsMap = new Map<string, Dependente[]>();
            (depsData || []).forEach((d: any) => {
              const list = depsMap.get(d.associado_id) || [];
              list.push(d);
              depsMap.set(d.associado_id, list);
            });

            data = assocData.map(a => ({
              ...a,
              dependentes: depsMap.get(a.id) || a.dependentes || []
            }));
          } catch (dErr) {
            data = assocData.map(a => ({
              ...a,
              dependentes: a.dependentes || []
            }));
          }
        } else {
          data = [];
        }
      }

      // Salva no cache local IDB
      if (data) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
      }
      associados = (data as Associado[]) || [];
    } catch (error) {
      console.warn('Supabase fetch failed, falling back to IDB:', error);
      associados = await getAllFromIDB<Associado>(STORE_NAME);
    }
  } else {
    associados = await getAllFromIDB<Associado>(STORE_NAME);
  }

  // Ensure we filter by tenant_id for IDB fallbacks
  return associados.filter(a => {
    if (!a) return false;
    if (a.deleted_at) return false;
    if (tenantId && tenantId !== 'all' && a?.tenant_id !== tenantId) return false;
    return true;
  });
};

export const saveAssociado = async (associado: Associado, isOnline: boolean): Promise<void> => {
  const existing = await getFromIDB<Associado>(STORE_NAME, associado.id);
  
  // Extrai dependentes para não enviar à tabela associados (pois é uma tabela separada)
  const { dependentes, ...associadoData } = associado;

  // Validação do UUID: garante que o ID do associado é um UUID v4 válido
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(associadoData.id)) {
    throw new Error(`ID do associado inválido: "${associadoData.id}". Use um UUID válido.`);
  }
  
  if (isOnline) {
    try {
      const { error } = await supabase
        .from('associados')
        .upsert(associadoData, { onConflict: 'id' });
            
      if (error) {
        console.error('Supabase save failed:', error);
        throw new Error(`Erro ao salvar no banco: ${error.message}`);
      }
      
      if (dependentes) {
        // Exclui dependentes antigos e insere os novos
        await supabase.from('dependentes').delete().eq('associado_id', associado.id);
        if (dependentes.length > 0) {
          const depsToInsert = dependentes.map(d => {
            // Garantir que cada dependente tem um UUID válido
            const depId = UUID_REGEX.test(d.id || '') ? d.id : undefined;
            return {
              ...d,
              ...(depId ? { id: depId } : {}), // Deixar o banco gerar se inválido
              associado_id: associado.id,
              tenant_id: associado.tenant_id
            };
          });
          const { error: depError } = await supabase.from('dependentes').insert(depsToInsert);
          if (depError) {
            console.warn('Erro ao inserir dependentes:', depError);
          }
        }
      }
    } catch (err) {
      console.error('Supabase save threw error:', err);
      throw err;
    }
  } else {
    await addToSyncQueue({
      storeName: 'associados',
      action: 'update',
      data: associado
    });
  }
  
  // Sincroniza IDB pós-escrita
  await saveToIDB(STORE_NAME, associado);
  
  const acao = existing ? 'Editar Associado' : 'Criar Associado';
  await registrarAuditoria(acao, { 
    id: associado.id, 
    nome: associado.nome,
    dados_anteriores: existing,
    dados_novos: associado
  });
};

export const softDeleteAssociado = async (id: string, isOnline: boolean): Promise<void> => {
  if (isOnline) {
    let { error } = await supabase
      .from('associados')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Soft delete failed, trying hard delete...', error);
      const hardDelete = await supabase.from('associados').delete().eq('id', id);
      if (hardDelete.error) {
         console.warn('Hard delete also failed. Proceeding with IDB only.', hardDelete.error);
      }
    }
  } else {
    await addToSyncQueue({
      storeName: 'associados',
      action: 'delete',
      data: { id }
    });
  }

  await deleteFromIDB(STORE_NAME, id);
  await registrarAuditoria('Excluir Associado (Soft Delete)', { id });
};
export interface DocumentoAssociado {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
  data_upload: string;
}
