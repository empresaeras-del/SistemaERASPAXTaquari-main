import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { primeOfflineCache, getLastSyncTime, SyncProgress } from '../services/cachePrimingService';
import { processSyncQueue } from '../lib/syncService';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const useOfflineSync = () => {
  const { state } = useAppContext();
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncFormatted, setLastSyncFormatted] = useState<string>('Nunca sincronizado');
  const [isPriming, setIsPriming] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);

  const updateLastSync = useCallback(async () => {
    const raw = await getLastSyncTime();
    setLastSyncTime(raw);
    if (raw) {
      try {
        const parsed = parseISO(raw);
        setLastSyncFormatted(formatDistanceToNow(parsed, { addSuffix: true, locale: ptBR }));
      } catch (e) {
        setLastSyncFormatted(new Date(raw).toLocaleString('pt-BR'));
      }
    } else {
      setLastSyncFormatted('Nunca sincronizado');
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!state.isOnline) return { success: false, error: 'Dispositivo offline' };

    setIsPriming(true);
    try {
      // 1. Processa fila pendente de mutações primeiro
      await processSyncQueue(state.isOnline);
      // 2. Pré-carrega toda a base para navegação offline
      const res = await primeOfflineCache(state.empresaSelecionada, (p) => {
        setProgress(p);
      });
      await updateLastSync();
      return res;
    } finally {
      setIsPriming(false);
    }
  }, [state.isOnline, state.empresaSelecionada, updateLastSync]);

  useEffect(() => {
    updateLastSync();

    const handleCompleted = () => {
      updateLastSync();
    };

    const handleStatus = (e: any) => {
      setIsPriming(!!e.detail?.isSyncing);
    };

    window.addEventListener('cache_priming_completed', handleCompleted);
    window.addEventListener('cache_priming_status', handleStatus);

    return () => {
      window.removeEventListener('cache_priming_completed', handleCompleted);
      window.removeEventListener('cache_priming_status', handleStatus);
    };
  }, [updateLastSync]);

  // Executa uma sincronização em segundo plano no carregamento inicial se estiver online
  useEffect(() => {
    if (state.isOnline && state.user) {
      getLastSyncTime().then((raw) => {
        const shouldSync = !raw || Date.now() - new Date(raw).getTime() > 1000 * 60 * 60 * 2; // > 2 horas
        if (shouldSync) {
          primeOfflineCache(state.empresaSelecionada).then(() => {
            updateLastSync();
          });
        }
      });
    }
  }, [state.isOnline, state.user, state.empresaSelecionada, updateLastSync]);

  return {
    lastSyncTime,
    lastSyncFormatted,
    isPriming,
    progress,
    syncNow,
  };
};
