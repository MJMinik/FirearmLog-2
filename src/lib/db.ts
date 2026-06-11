// The data layer (spec §3.2). Nothing else in the app touches IndexedDB.
// This module is the seam where a cloud sync service could plug in later.

import type { DataSet } from './types.ts';

const DB_NAME = 'firearmlog';
const SCHEMA_VERSION = 1;

export const STORE_NAMES = [
  'firearms', 'sessions', 'drills', 'ammunition', 'purchases',
  'maintenance', 'malfunctions', 'magazines', 'optics', 'parts',
  'goals', 'skills', 'matches', 'classifiers', 'references',
  'media', 'trash', 'meta'
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).getAll();
  await txDone(tx);
  return req.result as T[];
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).get(id);
  await txDone(tx);
  return req.result as T | undefined;
}

export async function putOne<T>(store: StoreName, record: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(record as unknown as object);
  await txDone(tx);
}

export async function deleteOne(store: StoreName, id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

export async function countAll(store: StoreName): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).count();
  await txDone(tx);
  return req.result;
}

/** Write a whole imported data set in one transaction — all or nothing. */
export async function commitDataSet(data: DataSet, settings: unknown): Promise<void> {
  const db = await openDb();
  const stores: StoreName[] = [
    'firearms', 'sessions', 'drills', 'ammunition', 'purchases',
    'maintenance', 'malfunctions', 'magazines', 'optics', 'parts',
    'goals', 'skills', 'matches', 'classifiers', 'media', 'trash', 'meta'
  ];
  const tx = db.transaction(stores, 'readwrite');
  const putAll = (store: StoreName, records: object[]) => {
    const os = tx.objectStore(store);
    for (const r of records) os.put(r);
  };
  putAll('firearms', data.firearms);
  putAll('sessions', data.sessions);
  putAll('drills', data.drills);
  putAll('ammunition', data.ammunition);
  putAll('purchases', data.purchases);
  putAll('maintenance', data.maintenance);
  putAll('malfunctions', data.malfunctions);
  putAll('magazines', data.magazines);
  putAll('optics', data.optics);
  putAll('parts', data.parts);
  putAll('goals', data.goals);
  putAll('skills', data.skills);
  putAll('matches', data.matches);
  putAll('classifiers', data.classifiers);
  putAll('media', data.media);
  putAll('trash', data.trash);
  if (settings !== undefined) {
    tx.objectStore('meta').put({ key: 'settings', value: settings });
  }
  await txDone(tx);
}

export async function getSettings<T>(): Promise<T | undefined> {
  const row = await getOne<{ key: string; value: T }>('meta', 'settings');
  return row?.value;
}
