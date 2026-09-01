import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { generateUUID } from '../utils/uuid';

export interface Notificacao {
  id: string;
  tenant_id?: string;
  usuario_id: string; // id of the user this belongs to, or 'system' / 'all'
  titulo: string;
  mensagem: string;
  tipo: 'alerta' | 'info' | 'sucesso' | 'erro' | 'acao';
  lida: boolean;
  link?: string; // Optional link for actions
  created_at: string;
  deleted_at?: string | null;
}

const STORE_NAME = 'notificacoes';

export const getNotificacoes = async (isOnline: boolean, usuarioId: string, tenantId: string | null): Promise<Notificacao[]> => {
  let notificacoes: Notificacao[] = [];

  if (isOnline) {
    try {
      let query = supabase.from('notificacoes').select('*').is('deleted_at', null);
      if (tenantId && tenantId !== 'all') {
         query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null,tenant_id.eq.all,usuario_id.eq.${usuarioId}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
      }
      notificacoes = data || [];
    } catch (error) {
      console.warn('Supabase fetch failed for notificacoes, falling back to IDB.', error);
      notificacoes = await getAllFromIDB<Notificacao>(STORE_NAME);
    }
  } else {
    notificacoes = await getAllFromIDB<Notificacao>(STORE_NAME);
  }

  // Filter for user
  return notificacoes
    .filter(n => !n.deleted_at && (n.usuario_id === usuarioId || n.usuario_id === 'all' || !n.usuario_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const markAsRead = async (id: string, isOnline: boolean): Promise<void> => {
  try {
    if (isOnline) {
      try {
        await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
      } catch(e) {
        console.warn('Supabase markAsRead failed, doing IDB only', e);
      }
    }
    const notif = await getFromIDB<Notificacao>(STORE_NAME, id);
    if (notif) {
      await saveToIDB(STORE_NAME, { ...notif, lida: true });
    }
  } catch (error) {
    console.error('Erro ao marcar como lida', error);
  }
};

export const markAllAsRead = async (usuarioId: string, isOnline: boolean): Promise<void> => {
  try {
    if (isOnline) {
      try {
        await supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', usuarioId);
      } catch(e) {
        console.warn('Supabase markAllAsRead failed, doing IDB only', e);
      }
    }
    const all = await getAllFromIDB<Notificacao>(STORE_NAME);
    for (const notif of all) {
      if ((notif.usuario_id === usuarioId || notif.usuario_id === 'all') && !notif.lida) {
        await saveToIDB(STORE_NAME, { ...notif, lida: true });
      }
    }
  } catch (error) {
    console.error('Erro ao marcar todas como lidas', error);
  }
};

export const deleteNotificacao = async (id: string, isOnline: boolean): Promise<void> => {
  try {
    if (isOnline) {
      try {
        await supabase.from('notificacoes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      } catch(e) {
        console.warn('Supabase deleteNotificacao failed', e);
      }
    }
    await deleteFromIDB(STORE_NAME, id);
  } catch (error) {
    console.error('Erro ao excluir notificacao', error);
  }
};

export const createNotificacao = async (notificacao: Omit<Notificacao, 'id' | 'created_at'>, isOnline: boolean): Promise<void> => {
  const newNotif: Notificacao = {
    ...notificacao,
    id: generateUUID(),
    created_at: new Date().toISOString()
  };

  try {
    if (isOnline) {
      try {
        const payload: any = {
          id: newNotif.id,
          titulo: newNotif.titulo,
          mensagem: newNotif.mensagem,
          tipo: newNotif.tipo || 'info',
          lida: newNotif.lida || false,
          link: newNotif.link || null,
          usuario_id: newNotif.usuario_id || 'all',
          tenant_id: (newNotif.tenant_id && newNotif.tenant_id !== 'all') ? newNotif.tenant_id : null,
          created_at: newNotif.created_at
        };
        await supabase.from('notificacoes').insert([payload]);
      } catch(e) {
        console.warn('Supabase createNotificacao failed', e);
      }
    }
    await saveToIDB(STORE_NAME, newNotif);
  } catch (error) {
    console.error('Erro ao criar notificacao', error);
  }
};
