import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { Atendimento } from '../types/atendimentos';
import { excluirReceitasPorAtendimento } from './financeiroService';

const STORE_NAME = 'atendimentos';

/** Colunas `date`/`timestamptz` de `atendimentos`. */
const COLUNAS_DATA = [
  'falecido_data_nascimento',
  'data_obito',
  'data_velorio',
  'data_sepultamento',
] as const;

/** Colunas `uuid` de `atendimentos`. */
const COLUNAS_UUID = ['associado_id', 'dependente_id', 'created_by'] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Payload do atendimento no formato que o Postgres aceita.
 *
 * O formulário inicializa todo campo com `''` e é isso que chega aqui quando o operador
 * não preenche — mas `''` **não é vazio para o Postgres**, é um valor inválido: uma data
 * em branco vira `22007 invalid input syntax for type date: ""` e o insert inteiro é
 * recusado. O caso mais escondido era o de cliente externo, em que `falecidoId` nunca sai
 * de `''` e ia para `dependente_id` (uuid) — `22P02`.
 *
 * Campo em branco é ausência, e ausência se grava `NULL` (a mesma regra de
 * `credenciados.cnpj_cpf` e de `responsavelParaGravacao`). Normaliza-se aqui, no ponto de
 * escrita, porque é o único lugar por onde os dois caminhos — criar e editar — passam.
 *
 * `itens` sai do payload: eles moram em `atendimento_itens` e são gravados à parte.
 */
export const sanitizeAtendimentoForSupabase = (atendimento: Atendimento): Record<string, any> => {
  const { itens, ...dados } = atendimento as Atendimento & Record<string, any>;
  const limpo: Record<string, any> = { ...dados };

  for (const coluna of COLUNAS_DATA) {
    const valor = limpo[coluna];
    limpo[coluna] = typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
  }

  for (const coluna of COLUNAS_UUID) {
    const valor = limpo[coluna];
    limpo[coluna] = typeof valor === 'string' && UUID_REGEX.test(valor.trim()) ? valor.trim() : null;
  }

  return limpo;
};

export interface DadosAuditoriaExclusaoAtendimento {
  falecido_nome?: string;
  falecido_cpf?: string;
  tipo_cliente?: string;
  status?: string;
  valor_total?: number;
  usuario_nome?: string;
  usuario_email?: string;
  usuario_nivel?: string;
  justificativa?: string;
}

export const getAtendimentos = async (isOnline: boolean, tenantId?: string): Promise<Atendimento[]> => {
  if (isOnline) {
    try {
      let query = supabase.from('atendimentos').select('*, itens:atendimento_itens(*)').order('created_at', { ascending: false });
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Supabase getAtendimentos error:', error);
      } else if (data) {
        // Sync to IDB
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
        return data as Atendimento[];
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to IDB', e);
    }
  }

  let localData = await getAllFromIDB<Atendimento>(STORE_NAME);
  if (tenantId && tenantId !== 'all') {
    localData = localData.filter(a => a.tenant_id === tenantId);
  }
  return localData;
};

/**
 * Grava o atendimento.
 *
 * **Recusa do Postgres não é queda de rede, e as duas não podem terminar igual.** Até
 * 11/09/2026 as duas caíam no mesmo `console.warn`, a função seguia para o IndexedDB e
 * devolvia `void` como se tivesse dado certo — a tela exibia "Atendimento registrado com
 * sucesso!" e o registro não existia no banco. Como `getAtendimentos` devolve o que vem do
 * servidor quando a busca funciona, o atendimento sumia da lista no recarregamento
 * seguinte, sem erro em lugar nenhum. É a armadilha que o CLAUDE.md já descrevia em
 * `PGRST204`, aqui com outra causa: a tabela `atendimentos` estava **vazia** em produção.
 *
 * - **Exceção lançada** (rede fora, fetch abortado) é o caso offline-first legítimo: vai
 *   para o IndexedDB e entra na fila de sync, que existe para guardar o que ainda não
 *   subiu — e é ela que distingue "criado offline" de "excluído no servidor".
 * - **`error` devolvido pelo Supabase** é recusa: constraint, RLS, coluna inexistente.
 *   Repetir amanhã dá o mesmo resultado, então enfileirar seria só adiar a perda. A função
 *   lança, o formulário continua aberto com tudo preenchido e o operador vê o que houve.
 */
export const saveAtendimento = async (atendimento: Atendimento, isOnline: boolean): Promise<void> => {
  const { itens } = atendimento;
  const atendimentoData = sanitizeAtendimentoForSupabase(atendimento);

  if (isOnline) {
    let recusa: { message?: string; code?: string } | null = null;

    try {
      const { data: inserted, error } = await supabase
        .from('atendimentos')
        .upsert(atendimentoData)
        .select()
        .single();

      if (error) {
        recusa = error;
      } else if (inserted && itens && itens.length > 0) {
        // Save items
        const itensToInsert = itens.map(i => ({
            ...i,
            atendimento_id: inserted.id
        }));

        // delete old items first
        await supabase.from('atendimento_itens').delete().eq('atendimento_id', inserted.id);

        const { error: itemErr } = await supabase.from('atendimento_itens').insert(itensToInsert);
        if(itemErr) console.warn("Supabase item save failed", itemErr);
      }
    } catch (err) {
      // Rede: guarda local e enfileira. O dado não se perde e sobe depois.
      console.warn('Supabase save threw error.', err);
      await saveToIDB(STORE_NAME, atendimento);
      await addToSyncQueue({ storeName: STORE_NAME, action: 'insert', data: atendimento });
      return;
    }

    if (recusa) {
      console.error('Supabase recusou o atendimento:', recusa);
      throw new Error(
        `O servidor recusou o atendimento${recusa.code ? ` (${recusa.code})` : ''}: ` +
        `${recusa.message || 'erro desconhecido'}`,
      );
    }
  }

  await saveToIDB(STORE_NAME, atendimento);
};

export const excluirAtendimento = async (
  id: string,
  isOnline: boolean,
  dadosAuditoria?: DadosAuditoriaExclusaoAtendimento
): Promise<void> => {
  // 1. Exclusão em cascata das receitas vinculadas e suas respectivas parcelas
  let finInfo: { receitasExcluidas: string[]; parcelasExcluidasCount: number } = {
    receitasExcluidas: [],
    parcelasExcluidasCount: 0
  };

  try {
    finInfo = await excluirReceitasPorAtendimento(id, isOnline);
  } catch (errFin) {
    console.warn('Aviso ao excluir receitas vinculadas ao atendimento:', errFin);
  }

  // 2. Limpeza local no IndexedDB
  await deleteFromIDB(STORE_NAME, id);
  try {
    const allItens = await getAllFromIDB<any>('atendimento_itens');
    for (const item of (allItens || []).filter(i => i && i.atendimento_id === id)) {
      await deleteFromIDB('atendimento_itens', item.id);
    }
  } catch (e) {}

  // 3. Exclusão no Supabase ou atualização preventiva
  if (isOnline) {
    try {
      // a) Exclui itens do atendimento
      await supabase.from('atendimento_itens').delete().eq('atendimento_id', id);

      // b) Exclui o atendimento principal
      const { error } = await supabase.from('atendimentos').delete().eq('id', id);
      if (error) {
        await supabase.from('atendimentos').update({ deleted_at: new Date().toISOString(), status: 'cancelado' }).eq('id', id);
      }
    } catch (err) {
      console.warn('Erro ao excluir atendimento no Supabase:', err);
    }
  }

  // 4. Registro formal no log de auditoria
  try {
    await registrarAuditoria('Excluir Atendimento', {
      atendimento_id: id,
      falecido_nome: dadosAuditoria?.falecido_nome,
      falecido_cpf: dadosAuditoria?.falecido_cpf,
      tipo_cliente: dadosAuditoria?.tipo_cliente,
      status_anterior: dadosAuditoria?.status,
      valor_total: dadosAuditoria?.valor_total,
      receitas_excluidas: finInfo.receitasExcluidas,
      parcelas_excluidas_count: finInfo.parcelasExcluidasCount,
      justificativa: dadosAuditoria?.justificativa || 'Exclusão confirmada por administrador',
      usuario_solicitante: dadosAuditoria?.usuario_nome || dadosAuditoria?.usuario_email || 'Operador',
      usuario_nivel: dadosAuditoria?.usuario_nivel,
      data_exclusao: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Erro ao registrar auditoria de exclusão de atendimento:', e);
  }
};
