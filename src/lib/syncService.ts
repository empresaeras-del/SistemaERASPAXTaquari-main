import { supabase } from './supabase';
import { getFromIDB, saveToIDB, deleteFromIDB, getAllFromIDB } from './idb';
import { generateUUID } from '../utils/uuid';

export interface SyncTask {
  id: string;
  storeName: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  createdAt: string;
}

const SYNC_QUEUE_STORE = 'sync_queue';

export const addToSyncQueue = async (task: Omit<SyncTask, 'id' | 'createdAt'>) => {
  const newTask: SyncTask = {
    ...task,
    id: generateUUID(),
    createdAt: new Date().toISOString(),
  };
  await saveToIDB(SYNC_QUEUE_STORE, newTask);
  window.dispatchEvent(new Event('sync_queue_updated'));
};

export const getSyncQueue = async (): Promise<SyncTask[]> => {
  try {
    return await getAllFromIDB<SyncTask>(SYNC_QUEUE_STORE);
  } catch (e) {
    return [];
  }
};

export const processSyncQueue = async (isOnline: boolean) => {
  if (!isOnline) return;

  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  window.dispatchEvent(new CustomEvent('sync_status_changed', { detail: { isSyncing: true } }));

  for (const task of queue) {
    try {
      if (task.action === 'insert' || task.action === 'update') {
        const { error } = await supabase.from(task.storeName).upsert(task.data);
        if (error) throw error;
      } else if (task.action === 'delete') {
        const { error } = await supabase.from(task.storeName).update({ deleted_at: new Date().toISOString() }).eq('id', task.data.id);
        if (error) {
           const hardDelete = await supabase.from(task.storeName).delete().eq('id', task.data.id);
           if (hardDelete.error) throw hardDelete.error;
        }
      }
      // If success, remove from queue
      await deleteFromIDB(SYNC_QUEUE_STORE, task.id);
    } catch (error) {
      console.error(`Failed to process sync task ${task.id}`, error);
      // We could optionally break here to retry later in order
    }
  }

  window.dispatchEvent(new CustomEvent('sync_status_changed', { detail: { isSyncing: false } }));
  window.dispatchEvent(new Event('sync_queue_updated'));
};
