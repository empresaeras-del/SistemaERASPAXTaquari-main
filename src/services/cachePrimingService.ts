import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { bulkSaveToIDB } from '../lib/idb';
import { set, get } from '../lib/idb-safe';

export interface SyncProgress {
  isSyncing: boolean;
  totalTables: number;
  completedTables: number;
  currentTable: string;
  lastSyncTime: string | null;
  error: string | null;
}

const LAST_SYNC_KEY = 'eras_last_full_sync_timestamp';

export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    const time = await get<string>(LAST_SYNC_KEY);
    if (time) return time;
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch (e) {
    return localStorage.getItem(LAST_SYNC_KEY);
  }
};

export const setLastSyncTime = async (isoDate: string): Promise<void> => {
  try {
    await set(LAST_SYNC_KEY, isoDate);
    localStorage.setItem(LAST_SYNC_KEY, isoDate);
  } catch (e) {
    localStorage.setItem(LAST_SYNC_KEY, isoDate);
  }
};

let isPriming = false;

/**
 * Baixa e armazena no IndexedDB todos os dados essenciais para permitir
 * a visualização e navegação 100% offline em todas as telas do sistema.
 */
export const primeOfflineCache = async (
  tenantId: string | null,
  onProgress?: (progress: SyncProgress) => void
): Promise<{ success: boolean; error?: string }> => {
  if (isPriming) {
    return { success: false, error: 'Sincronização já está em andamento.' };
  }

  if (!navigator.onLine || !isSupabaseConfigured) {
    return { success: false, error: 'Dispositivo sem conexão para sincronização.' };
  }

  isPriming = true;
  window.dispatchEvent(new CustomEvent('cache_priming_status', { detail: { isSyncing: true } }));

  const tablesToSync: { table: string; store: string; filterTenant?: boolean }[] = [
    { table: 'tenants', store: 'empresas', filterTenant: false },
    { table: 'users', store: 'usuarios', filterTenant: false },
    { table: 'planos_pax', store: 'planos_pax', filterTenant: true },
    { table: 'planos_pax_coberturas', store: 'planos_pax_coberturas', filterTenant: false },
    { table: 'planos_pax_faixas', store: 'planos_pax_faixas', filterTenant: false },
    { table: 'itens_funerarios', store: 'itens_funerarios', filterTenant: true },
    { table: 'credenciados', store: 'credenciados', filterTenant: true },
    { table: 'procedimentos', store: 'procedimentos', filterTenant: true },
    { table: 'credenciados_planos', store: 'credenciados_planos', filterTenant: false },
    { table: 'credenciados_procedimentos', store: 'credenciados_procedimentos', filterTenant: false },
    { table: 'fornecedores', store: 'fornecedores', filterTenant: true },
    { table: 'associados', store: 'associados', filterTenant: true },
    { table: 'dependentes', store: 'dependentes', filterTenant: false },
    { table: 'contratos', store: 'contratos', filterTenant: true },
    { table: 'atendimentos', store: 'atendimentos', filterTenant: true },
    { table: 'atendimento_itens', store: 'atendimento_itens', filterTenant: false },
    { table: 'requisicoes', store: 'requisicoes', filterTenant: true },
    { table: 'requisicao_itens', store: 'requisicao_itens', filterTenant: false },
    { table: 'receitas', store: 'receitas', filterTenant: true },
    { table: 'parcelas_receber', store: 'parcelas_receber', filterTenant: false },
    { table: 'despesas', store: 'despesas', filterTenant: true },
    { table: 'parcelas_pagar', store: 'parcelas_pagar', filterTenant: false },
    { table: 'contas_bancarias', store: 'contas_bancarias', filterTenant: true },
    { table: 'lotes_caixa', store: 'lotes_caixa', filterTenant: true },
    { table: 'movimentacoes_caixa', store: 'movimentacoes_caixa', filterTenant: false },
    { table: 'documentos_padroes', store: 'documentos_padroes', filterTenant: true },
    { table: 'notificacoes', store: 'notificacoes', filterTenant: true },
  ];

  let completed = 0;

  try {
    for (const item of tablesToSync) {
      if (onProgress) {
        onProgress({
          isSyncing: true,
          totalTables: tablesToSync.length,
          completedTables: completed,
          currentTable: item.table,
          lastSyncTime: await getLastSyncTime(),
          error: null,
        });
      }

      try {
        let query = supabase.from(item.table).select('*');
        if (item.filterTenant && tenantId && tenantId !== 'all') {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          await bulkSaveToIDB(item.store, data);
        }
      } catch (err) {
        console.warn(`[Offline Cache] Falha ao pré-carregar tabela ${item.table}:`, err);
      }

      completed++;
    }

    const nowIso = new Date().toISOString();
    await setLastSyncTime(nowIso);

    if (onProgress) {
      onProgress({
        isSyncing: false,
        totalTables: tablesToSync.length,
        completedTables: completed,
        currentTable: 'Concluído',
        lastSyncTime: nowIso,
        error: null,
      });
    }

    window.dispatchEvent(new CustomEvent('cache_priming_completed', { detail: { timestamp: nowIso } }));
    return { success: true };
  } catch (globalError: any) {
    console.error('[Offline Cache] Erro global na sincronização:', globalError);
    if (onProgress) {
      onProgress({
        isSyncing: false,
        totalTables: tablesToSync.length,
        completedTables: completed,
        currentTable: 'Erro',
        lastSyncTime: await getLastSyncTime(),
        error: globalError?.message || 'Erro ao sincronizar dados.',
      });
    }
    return { success: false, error: globalError?.message };
  } finally {
    isPriming = false;
    window.dispatchEvent(new CustomEvent('cache_priming_status', { detail: { isSyncing: false } }));
  }
};
