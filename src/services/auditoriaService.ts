import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB } from '../lib/idb';

export interface LogAuditoria {
  id: string;
  tenant_id: string;
  usuario_id: string;
  acao: string;
  detalhes: any;
  created_at: string;
  // relations
  usuarios?: {
    nome: string;
    email: string;
  };
}

const STORE_NAME = 'auditoria';

export const getLogsAuditoria = async (isOnline: boolean, tenantId: string | null): Promise<LogAuditoria[]> => {
  let logs: LogAuditoria[] = [];

  if (isOnline) {
    try {
      let query = supabase
        .from('auditoria')
        .select(`
          *,
          usuarios (
            nome,
            email
          )
        `)
        .order('created_at', { ascending: false });
      
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
      logs = data || [];
    } catch (error) {
      console.warn('Supabase fetch failed (likely not configured), falling back to IDB.');
      logs = await getAllFromIDB<LogAuditoria>(STORE_NAME);
    }
  } else {
    logs = await getAllFromIDB<LogAuditoria>(STORE_NAME);
  }

  // Soft sorting and filtering
  return logs.filter(a => {
    if (!a) return false;
    if (tenantId && tenantId !== 'all' && a?.tenant_id !== tenantId) return false;
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
