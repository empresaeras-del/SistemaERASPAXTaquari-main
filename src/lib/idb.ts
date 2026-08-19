const DB_NAME = 'ERAS_DB';
const DB_VERSION = 22;

let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      console.warn('IndexedDB is not available synchronously:', e);
      return reject(e);
    }

    request.onerror = () => {
      console.error('Erro ao abrir IndexedDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      const stores = [
        'tenants',
        'empresas',
        'users',
        'usuarios',
        'associados',
        'dependentes',
        'contratos',
        'planos',
        'planos_pax',
        'planos_pax_coberturas',
        'planos_pax_faixas',
        'itens_funerarios',
        'fornecedores',
        'procedimentos',
        'credenciados',
        'credenciados_planos',
        'credenciados_procedimentos',
        'atendimentos',
        'atendimento_itens',
        'requisicoes',
        'requisicao_itens',
        'remessas_faturamento',
        'receitas',
        'parcelas_receber',
        'despesas',
        'parcelas_pagar',
        'financeiro',
        'contas_bancarias',
        'lotes_caixa',
        'movimentacoes_caixa',
        'documentos_padroes',
        'notificacoes',
        'auditoria',
        'preferencias',
        'sync_queue'
      ];

      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
  });

  return dbPromise;
};

export const getFromIDB = async <T>(storeName: string, id: string): Promise<T | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IDB getFromIDB failed', e);
    return null;
  }
};

export const getAllFromIDB = async <T>(storeName: string): Promise<T[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IDB getAllFromIDB failed', e);
    return [];
  }
};

export const saveToIDB = async <T>(storeName: string, data: T): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteFromIDB = async (storeName: string, id: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IDB deleteFromIDB failed', e);
  }
};
