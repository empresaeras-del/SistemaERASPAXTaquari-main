import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { Atendimento } from '../types/atendimentos';

const STORE_NAME = 'atendimentos';

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

export const excluirAtendimento = async (id: string, isOnline: boolean): Promise<void> => {
  // 1. Limpeza local no IndexedDB
  await deleteFromIDB(STORE_NAME, id);
  try {
    const allItens = await getAllFromIDB<any>('atendimento_itens');
    for (const item of (allItens || []).filter(i => i && i.atendimento_id === id)) {
      await deleteFromIDB('atendimento_itens', item.id);
    }
  } catch (e) {}

  // 2. Exclusão no Supabase ou enfileiramento
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

  try {
    await registrarAuditoria('Excluir Atendimento', { id });
  } catch (e) {}
};
