import { useState, useEffect, useRef } from 'react';
import { getSyncQueue, processSyncQueue, clearFailedSyncTasks } from '../lib/syncService';
import { useAppContext } from '../context/AppContext';

export const useSyncStatus = () => {
  const { state } = useAppContext();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateQueueCount = async () => {
    const queue = await getSyncQueue();
    setPendingCount(queue.length);
  };

  useEffect(() => {
    // Limpa tasks que falharam repetidamente ao inicializar
    clearFailedSyncTasks().then(() => updateQueueCount());

    const handleQueueUpdated = () => {
      updateQueueCount();
    };

    const handleSyncStatusChanged = (e: any) => {
      setIsSyncing(e.detail.isSyncing);
    };

    window.addEventListener('sync_queue_updated', handleQueueUpdated);
    window.addEventListener('sync_status_changed', handleSyncStatusChanged);

    return () => {
      window.removeEventListener('sync_queue_updated', handleQueueUpdated);
      window.removeEventListener('sync_status_changed', handleSyncStatusChanged);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (state.isOnline && pendingCount > 0 && !isSyncing) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        processSyncQueue(state.isOnline);
      }, 500);
    }
  }, [state.isOnline, pendingCount, isSyncing]);

  return { pendingCount, isSyncing };
};

