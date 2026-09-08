import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { generateUUID } from '../utils/uuid';
import { ehTenantUtilizavel, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';

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
      if (ehTenantUtilizavel(tenantId)) {
         // Uma notificação é minha se é da minha empresa ou se é endereçada a mim.
         // `tenant_id.is.null` e `tenant_id.eq.all` estavam aqui como "transmissão a
         // todos" — um escape que nenhuma notificação real usava (0 registros) e que
         // fazia a caixa de um usuário aparecer para as outras empresas.
         query = query.or(`tenant_id.eq.${tenantId},usuario_id.eq.${usuarioId}`);
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

  // Mesmo critério da policy no servidor: a notificação é minha se é endereçada a mim,
  // ou se pertence à minha empresa. O caminho offline lê o IndexedDB inteiro, então
  // precisa aplicar o filtro de empresa aqui — antes ele checava só o destinatário, e um
  // `usuario_id: 'all'` em cache atravessava a fronteira entre empresas.
  //
  // A regra é mais estrita que a de `registroPertenceAoTenant`, e de propósito: aquele
  // predicado deixa passar registro sem tenant (é o catálogo compartilhado, como
  // `procedimentos`) e desliga o filtro quando não há empresa selecionada. Notificação não
  // tem catálogo compartilhado — sem tenant, ou sem empresa para comparar, só vale o que
  // está endereçado a mim.
  return notificacoes
    .filter(n => {
      if (n.deleted_at) return false;
      if (n.usuario_id === usuarioId) return true;
      if (!ehTenantUtilizavel(n.tenant_id) || !ehTenantUtilizavel(tenantId)) return false;
      if (n.tenant_id !== tenantId) return false;
      return n.usuario_id === 'all' || !n.usuario_id;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

/**
 * O usuário já teve alguma notificação — inclusive as que ele já apagou?
 *
 * `getNotificacoes` filtra `deleted_at IS NULL`, então "caixa vazia" e "usuário novo" são
 * indistinguíveis por lá. Como excluir é *soft delete*, quem apagava todas as suas
 * notificações voltava a parecer novo e ganhava as de boas-vindas de novo, a cada
 * carregamento. Um usuário chegou a acumular 24 delas, 22 já excluídas.
 *
 * Esta função é a pergunta certa para decidir o seeding: conta o histórico, não a caixa.
 * Só responde online — offline não dá para distinguir "não tem" de "ainda não sincronizou",
 * e semear no escuro é exatamente o que produzia duplicata.
 */
export const usuarioJaTeveNotificacao = async (isOnline: boolean, usuarioId: string): Promise<boolean> => {
  if (!isOnline) return true; // no escuro, assume que sim: não semear é o lado seguro
  try {
    const { count, error } = await supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId);
    if (error) throw error;
    return (count ?? 0) > 0;
  } catch (e) {
    console.warn('Não foi possível conferir o histórico de notificações; seeding adiado.', e);
    return true;
  }
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
        // Sem empresa e sem destinatário, os defaults antigos eram `usuario_id: 'all'` e
        // `tenant_id: null` — os dois valores que a policy lia como "todo mundo, em todas
        // as empresas". Uma notificação precisa de dono; sem ele, não vai para o servidor.
        if (!ehTenantUtilizavel(newNotif.tenant_id)) {
          throw new Error(`Notificação sem empresa definida. ${MENSAGEM_TENANT_INDEFINIDO}`);
        }
        if (!newNotif.usuario_id) {
          throw new Error('Notificação sem destinatário: informe o usuário ou o escopo da empresa.');
        }
        const payload: any = {
          id: newNotif.id,
          titulo: newNotif.titulo,
          mensagem: newNotif.mensagem,
          tipo: newNotif.tipo || 'info',
          lida: newNotif.lida || false,
          link: newNotif.link || null,
          usuario_id: newNotif.usuario_id,
          tenant_id: newNotif.tenant_id,
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
