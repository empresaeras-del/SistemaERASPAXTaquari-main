const DB_NAME = 'ERAS_DB';
const DB_VERSION = 21;

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
      
      // Criação das object stores se não existirem
      if (!db.objectStoreNames.contains('associados')) {
        db.createObjectStore('associados', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('atendimentos')) {
        db.createObjectStore('atendimentos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('receitas')) {
        db.createObjectStore('receitas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('parcelas_receber')) {
        db.createObjectStore('parcelas_receber', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('despesas')) {
        db.createObjectStore('despesas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('parcelas_pagar')) {
        db.createObjectStore('parcelas_pagar', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('financeiro')) {
        db.createObjectStore('financeiro', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('empresas')) {
        db.createObjectStore('empresas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('usuarios')) {
        db.createObjectStore('usuarios', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('auditoria')) {
        db.createObjectStore('auditoria', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('planos')) {
        db.createObjectStore('planos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('planos_pax')) {
        db.createObjectStore('planos_pax', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('itens_funerarios')) {
        db.createObjectStore('itens_funerarios', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('credenciados')) {
        db.createObjectStore('credenciados', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('preferencias')) {
        db.createObjectStore('preferencias', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('documentos_padroes')) {
        db.createObjectStore('documentos_padroes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('credenciados_planos')) {
        db.createObjectStore('credenciados_planos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('procedimentos')) {
        db.createObjectStore('procedimentos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('credenciados_procedimentos')) {
        db.createObjectStore('credenciados_procedimentos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) { db.createObjectStore('sync_queue', { keyPath: 'id' }); }
      if (!db.objectStoreNames.contains('notificacoes')) {
        db.createObjectStore('notificacoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('lotes_caixa')) {
        db.createObjectStore('lotes_caixa', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('movimentacoes_caixa')) {
        db.createObjectStore('movimentacoes_caixa', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('requisicoes')) {
        db.createObjectStore('requisicoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('remessas_faturamento')) {
        db.createObjectStore('remessas_faturamento', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('fornecedores')) {
        db.createObjectStore('fornecedores', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('contas_bancarias')) {
        db.createObjectStore('contas_bancarias', { keyPath: 'id' });
      }
      // Adicionar mais stores conforme a necessidade
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
