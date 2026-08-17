import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';

export interface Plano {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  preco: number;
  periodicidade: 'mensal' | 'anual' | 'unico';
  status: 'ativo' | 'inativo';
  created_at?: string;
  deleted_at?: string | null;
}

const STORE_NAME = 'planos';

export const getPlanos = async (isOnline: boolean, tenantId?: string | null): Promise<Plano[]> => {
  let planos: Plano[] = [];

  if (isOnline) {
    try {
      let query = supabase.from('planos').select('*').eq('deleted_at', null);
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
      }
      planos = data || [];
    } catch (error) {
      console.warn('Supabase fetch failed (likely not configured), falling back to IDB.');
      planos = await getAllFromIDB<Plano>(STORE_NAME);
    }
  } else {
    planos = await getAllFromIDB<Plano>(STORE_NAME);
  }

  return planos.filter(p => {
    if (!p) return false;
    if (p.deleted_at) return false;
    if (tenantId && tenantId !== 'all' && p?.tenant_id !== tenantId) return false;
    return true;
  });
};

export const savePlano = async (plano: Plano, isOnline: boolean): Promise<void> => {
  const existing = await getFromIDB<Plano>(STORE_NAME, plano.id);
  
  if (isOnline) {
    try {
      const { error } = await supabase.from('planos').upsert(plano);
      if (error) {
        console.warn('Supabase save failed, proceeding with IDB only.', error);
      }
    } catch (err) {
      console.warn('Supabase save threw error, proceeding with IDB only.', err);
    }
  } else {
    await addToSyncQueue({
      storeName: 'planos',
      action: 'update',
      data: plano
    });
  }
  await saveToIDB(STORE_NAME, plano);
  
  const acao = existing ? 'Editar Plano' : 'Criar Plano';
  await registrarAuditoria(acao, { 
    id: plano.id, 
    nome: plano.nome,
    dados_anteriores: existing,
    dados_novos: plano
  });
};

export const deletePlano = async (id: string, isOnline: boolean): Promise<void> => {
  if (isOnline) {
    const { error } = await supabase
      .from('planos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
       console.warn('Supabase delete failed, proceeding with IDB only.');
    }
  } else {
    await addToSyncQueue({
      storeName: 'planos',
      action: 'delete',
      data: { id }
    });
  }
  const plano = await getFromIDB<Plano>(STORE_NAME, id);
  if (plano) {
    plano.deleted_at = new Date().toISOString();
    await saveToIDB(STORE_NAME, plano);
  }
  await registrarAuditoria('Excluir Plano (Soft Delete)', { id });
};
