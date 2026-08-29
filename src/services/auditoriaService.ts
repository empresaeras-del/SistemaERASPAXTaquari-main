import { supabase } from '../lib/supabase';
import { saveToIDB, getAllFromIDB } from '../lib/idb';
import { getUsuarios, UsuarioCadastro } from './usuariosService';

export interface LogAuditoria {
  id: string;
  tenant_id: string;
  usuario_id: string;
  usuario_nome?: string;
  acao: string;
  detalhes: any;
  created_at: string;
  // relations & enriched info
  usuarios?: {
    nome: string;
    email: string;
    nivel?: string;
  };
}

const STORE_NAME = 'auditoria';

export const getLogsAuditoria = async (isOnline: boolean, tenantId: string | null): Promise<LogAuditoria[]> => {
  let logs: LogAuditoria[] = [];
  const usersMap = new Map<string, UsuarioCadastro>();

  // 1. Carrega mapeamento de usuários para enriquecer os logs com nome e email reais
  try {
    const usuariosList = await getUsuarios(isOnline, 'all');
    usuariosList.forEach(u => {
      if (u.id) usersMap.set(u.id, u);
      if (u.email) usersMap.set(u.email.toLowerCase(), u);
    });
  } catch (e) {
    console.warn('Erro ao carregar mapa de usuários para auditoria:', e);
  }

  // 2. Busca logs do Supabase ou IndexedDB
  if (isOnline) {
    try {
      let query = supabase
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (data && data.length > 0) {
        logs = data.map((item: any) => {
          let userObj = item.usuarios;
          if (!userObj || !userObj.nome) {
            const matchedUser = usersMap.get(item.usuario_id) || (item.detalhes?.usuario_email ? usersMap.get(item.detalhes.usuario_email.toLowerCase()) : undefined);
            if (matchedUser) {
              userObj = {
                nome: matchedUser.nome,
                email: matchedUser.email,
                nivel: matchedUser.nivel
              };
            } else if (item.usuario_nome) {
              userObj = {
                nome: item.usuario_nome,
                email: item.detalhes?.usuario_email || item.detalhes?.email || 'N/A'
              };
            } else if (item.detalhes?.usuario) {
              userObj = {
                nome: item.detalhes.usuario,
                email: item.detalhes?.usuario_email || 'N/A'
              };
            } else if (item.usuario_id === 'system' || !item.usuario_id) {
              userObj = {
                nome: 'Sistema / Automático',
                email: 'sistema@eras.com.br',
                nivel: 'sistema'
              };
            } else {
              userObj = {
                nome: 'Operador (' + (item.usuario_id ? item.usuario_id.slice(0, 8) : 'N/A') + ')',
                email: 'N/A'
              };
            }
          }

          return {
            ...item,
            usuarios: userObj
          };
        });

        // Sincroniza os registros online para o IndexedDB local
        for (const item of logs) {
          await saveToIDB(STORE_NAME, item);
        }
      } else {
        logs = await getAllFromIDB<LogAuditoria>(STORE_NAME);
      }
    } catch (error) {
      console.warn('Supabase fetch auditoria falhou, usando IndexedDB:', error);
      logs = await getAllFromIDB<LogAuditoria>(STORE_NAME);
    }
  } else {
    logs = await getAllFromIDB<LogAuditoria>(STORE_NAME);
  }

  // 3. Enriquece logs que vieram do IDB sem info completa do usuário
  const enrichedLogs = logs.map(log => {
    if (!log.usuarios || !log.usuarios.nome || log.usuarios.nome === 'Usuário Supabase' || log.usuarios.nome === 'Sistema') {
      const matched = usersMap.get(log.usuario_id) || (log.usuarios?.email ? usersMap.get(log.usuarios.email.toLowerCase()) : undefined);
      if (matched) {
        return {
          ...log,
          usuarios: {
            nome: matched.nome,
            email: matched.email,
            nivel: matched.nivel
          }
        };
      }
    }
    return log;
  });

  // 4. Filtro por Tenant e Ordenação Decrescente
  return enrichedLogs.filter(a => {
    if (!a) return false;
    if (tenantId && tenantId !== 'all' && a?.tenant_id && a.tenant_id !== tenantId) return false;
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
