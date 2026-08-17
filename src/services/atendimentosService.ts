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
