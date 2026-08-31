const DB_NAME = 'buylens';
const DB_VERSION = 1;

export const STORE_NAMES = [
  'products',
  'researches',
  'comparisonGroups',
  'preferences',
  'settings'
];

let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('researches')) {
        const store = db.createObjectStore('researches', { keyPath: 'id' });
        store.createIndex('productId', 'productId', { unique: false });
      }

      if (!db.objectStoreNames.contains('comparisonGroups')) {
        db.createObjectStore('comparisonGroups', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => reject(request.error || new Error('IndexedDBを開けませんでした。'));
    request.onblocked = () => reject(new Error('別タブがデータベース更新を妨げています。'));
  });

  return dbPromise;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('保存処理に失敗しました。'));
    transaction.onabort = () => reject(transaction.error || new Error('保存処理が中断されました。'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('データ操作に失敗しました。'));
  });
}

export async function getAll(storeName) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readonly');
  const result = await requestResult(transaction.objectStore(storeName).getAll());
  await transactionDone(transaction);
  return result;
}

export async function getOne(storeName, key) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readonly');
  const result = await requestResult(transaction.objectStore(storeName).get(key));
  await transactionDone(transaction);
  return result;
}

export async function putOne(storeName, value) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
  return value;
}

export async function deleteOne(storeName, key) {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

export async function deleteProductCascade(productId) {
  const db = await openDb();
  const transaction = db.transaction(['products', 'researches', 'comparisonGroups'], 'readwrite');

  transaction.objectStore('products').delete(productId);

  const researchStore = transaction.objectStore('researches');
  const researchIndex = researchStore.index('productId');
  const cursorRequest = researchIndex.openCursor(IDBKeyRange.only(productId));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };

  const groupStore = transaction.objectStore('comparisonGroups');
  const groupsRequest = groupStore.getAll();
  groupsRequest.onsuccess = () => {
    for (const group of groupsRequest.result) {
      if (!Array.isArray(group.productIds) || !group.productIds.includes(productId)) continue;
      group.productIds = group.productIds.filter((id) => id !== productId);
      for (const key of ['bestOverall', 'bestValue', 'bestPerformance', 'avoid']) {
        if (group.summary?.[key] === productId) group.summary[key] = '';
      }
      group.updatedAt = new Date().toISOString();
      groupStore.put(group);
    }
  };

  await transactionDone(transaction);
}

export async function getResearchesForProduct(productId) {
  const db = await openDb();
  const transaction = db.transaction('researches', 'readonly');
  const index = transaction.objectStore('researches').index('productId');
  const result = await requestResult(index.getAll(IDBKeyRange.only(productId)));
  await transactionDone(transaction);
  return result.sort((a, b) => String(b.researchedAt).localeCompare(String(a.researchedAt)));
}

export async function exportAllData() {
  const data = {};
  for (const storeName of STORE_NAMES) {
    data[storeName] = await getAll(storeName);
  }
  return data;
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Backup JSONの形式が不正です。');
  if (payload.app !== 'BuyLens') throw new Error('BuyLensのBackupではありません。');
  if (payload.schemaVersion !== 1) throw new Error('対応していないBackup Schemaです。');
  if (!payload.data || typeof payload.data !== 'object') throw new Error('Backup dataがありません。');

  for (const storeName of STORE_NAMES) {
    if (!Array.isArray(payload.data[storeName])) {
      throw new Error(`${storeName} が配列ではありません。`);
    }
  }

  for (const product of payload.data.products) {
    if (!product || typeof product.id !== 'string' || typeof product.name !== 'string') {
      throw new Error('products に不正なレコードがあります。');
    }
  }

  for (const research of payload.data.researches) {
    if (!research || typeof research.id !== 'string' || typeof research.productId !== 'string') {
      throw new Error('researches に不正なレコードがあります。');
    }
  }

  for (const group of payload.data.comparisonGroups) {
    if (!group || typeof group.id !== 'string' || !Array.isArray(group.productIds)) {
      throw new Error('comparisonGroups に不正なレコードがあります。');
    }
  }

  for (const preference of payload.data.preferences) {
    if (!preference || typeof preference.id !== 'string') {
      throw new Error('preferences に不正なレコードがあります。');
    }
  }

  for (const setting of payload.data.settings) {
    if (!setting || typeof setting.key !== 'string') {
      throw new Error('settings に不正なレコードがあります。');
    }
  }

  return payload;
}

export async function replaceAllData(payload) {
  validateBackupPayload(payload);
  const db = await openDb();
  const transaction = db.transaction(STORE_NAMES, 'readwrite');

  for (const storeName of STORE_NAMES) {
    const store = transaction.objectStore(storeName);
    store.clear();
    for (const record of payload.data[storeName]) {
      store.put(record);
    }
  }

  await transactionDone(transaction);
}
