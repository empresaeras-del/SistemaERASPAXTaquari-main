import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { Atendimento } from '../types/atendimentos';
import { excluirReceitasPorAtendimento } from './financeiroService';

const STORE_NAME = 'atendimentos';

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

export const saveAtendimento = async (atendimento: Atendimento, isOnline: boolean): Promise<void> => {
  const { itens, ...atendimentoData } = atendimento;
  
  if (isOnline) {
    try {
      const { data: inserted, error } = await supabase
        .from('atendimentos')
        .upsert(atendimentoData)
        .select()
        .single();
        
      if (error) {
        console.warn('Supabase save failed:', error);
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
      console.warn('Supabase save threw error.', err);
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
