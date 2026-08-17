import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, clear as idbClear } from 'idb-keyval';

export const get = async <T = any>(key: IDBValidKey): Promise<T | undefined> => {
  try {
    return await idbGet(key);
  } catch (e) {
    console.warn('idb-keyval get failed:', e);
    return undefined;
  }
};

export const set = async (key: IDBValidKey, value: any): Promise<void> => {
  try {
    await idbSet(key, value);
  } catch (e) {
    console.warn('idb-keyval set failed:', e);
  }
};

export const del = async (key: IDBValidKey): Promise<void> => {
  try {
    await idbDel(key);
  } catch (e) {
    console.warn('idb-keyval del failed:', e);
  }
};

export const keys = async (): Promise<IDBValidKey[]> => {
  try {
    return await idbKeys();
  } catch (e) {
    console.warn('idb-keyval keys failed:', e);
    return [];
  }
};

export const clear = async (): Promise<void> => {
  try {
    await idbClear();
  } catch (e) {
    console.warn('idb-keyval clear failed:', e);
  }
};
