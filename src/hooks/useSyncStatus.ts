import { useState, useEffect } from 'react';
import { getSyncQueue, processSyncQueue } from '../lib/syncService';
import { useAppContext } from '../context/AppContext';

export const useSyncStatus = () => {
  const { state } = useAppContext();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateQueueCount = async () => {
    const queue = await getSyncQueue();
    setPendingCount(queue.length);
  };

  useEffect(() => {
    updateQueueCount();

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
    };
  }, []);

  useEffect(() => {
    if (state.isOnline && pendingCount > 0 && !isSyncing) {
      processSyncQueue(state.isOnline);
    }
  }, [state.isOnline, pendingCount, isSyncing]);

  return { pendingCount, isSyncing };
};
