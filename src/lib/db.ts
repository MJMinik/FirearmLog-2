// The data layer (spec §3.2). Nothing else in the app touches IndexedDB.
// This module is the seam where a cloud sync service could plug in later.

import type { DataSet, Media } from './types.ts';
import type { Snapshot } from './flog.ts';
import { newestStamp } from './flog.ts';

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

/**
 * Write a whole imported data set. Small records go in one transaction;
 * photos/videos are saved ONE PER TRANSACTION because iPhone Safari chokes
 * on many megabytes in a single write. onProgress reports photo progress.
 */
export async function commitDataSet(
  data: DataSet,
  settings: unknown,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const db = await openDb();
  const stores: StoreName[] = [
    'firearms', 'sessions', 'drills', 'ammunition', 'purchases',
    'maintenance', 'malfunctions', 'magazines', 'optics', 'parts',
    'goals', 'skills', 'matches', 'classifiers', 'trash', 'meta'
  ];
  const tx = db.transaction(stores, 'readwrite');
  const putAll = (store: StoreName, records: object[]) => {
    const os = tx.objectStore(store);
    for (const r of records) os.put(r);
  };
  putAll('firearms', data.firearms);
  putAll('sessions', data.sessions);
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
  putAll('trash', data.trash);
  if (settings !== undefined) {
    tx.objectStore('meta').put({ key: 'settings', value: settings });
  }
  await txDone(tx);

  // Imports replace import-derived drills (IDs starting 'dr-'). Custom drills
  // made in the app use 'drx-' IDs and survive a re-import untouched.
  // (Edits made to imported drills are reset by a re-import — by design.)
  const existingDrills = await getAll<{ id: string }>('drills');
  const dtx0 = db.transaction('drills', 'readwrite');
  for (const d of existingDrills) {
    if (d.id.startsWith('dr-')) dtx0.objectStore('drills').delete(d.id);
  }
  for (const d of data.drills) dtx0.objectStore('drills').put(d);
  await txDone(dtx0);

  // Re-imports must never duplicate photos: clear out any existing photos
  // that belong to the records we just (re)wrote, then save the fresh set.
  const ownerIds = new Set<string>();
  for (const f of data.firearms) ownerIds.add(f.id);
  for (const sn of data.sessions) ownerIds.add(sn.id);
  for (const m of data.matches) ownerIds.add(m.id);
  const existing = await getAll<Media>('media');
  for (const m of existing) {
    if (ownerIds.has(m.ownerId)) {
      const dtx = db.transaction('media', 'readwrite');
      dtx.objectStore('media').delete(m.id);
      await txDone(dtx);
    }
  }

  // Photos one at a time, with progress and breathing room for the browser.
  const total = data.media.length;
  let done = 0;
  onProgress?.(done, total);
  for (const m of data.media) {
    const mtx = db.transaction('media', 'readwrite');
    mtx.objectStore('media').put(m);
    await txDone(mtx);
    done += 1;
    onProgress?.(done, total);
    await new Promise((r) => setTimeout(r, 0));
  }
}

export async function getSettings<T>(): Promise<T | undefined> {
  const row = await getOne<{ key: string; value: T }>('meta', 'settings');
  return row?.value;
}

/** Every store except media, for snapshot export. */
const SNAPSHOT_STORES: StoreName[] = [
  'firearms', 'sessions', 'drills', 'ammunition', 'purchases',
  'maintenance', 'malfunctions', 'magazines', 'optics', 'parts',
  'goals', 'skills', 'matches', 'classifiers', 'references', 'trash', 'meta'
];

/** Everything in the database, packaged to travel (spec §7.1). */
export async function exportSnapshot(): Promise<Snapshot> {
  const stores: Record<string, unknown[]> = {};
  for (const name of SNAPSHOT_STORES) stores[name] = await getAll(name);
  const media = await getAll<Media>('media');
  return {
    exportedAt: Date.now(),
    lastModified: newestStamp(stores, media),
    stores,
    media
  };
}

/** Newest real change on this device (never bumped by mere app-open). */
export async function localLastModified(): Promise<number> {
  const stores: Record<string, unknown[]> = {};
  for (const name of SNAPSHOT_STORES) stores[name] = await getAll(name);
  const media = await getAll<Media>('media');
  return newestStamp(stores, media);
}

/** Pull: REPLACE everything on this device with the file's contents. */
export async function restoreSnapshot(
  snapshot: Snapshot,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const db = await openDb();

  // Wipe and rewrite the regular stores in one transaction — all or nothing.
  const tx = db.transaction([...SNAPSHOT_STORES], 'readwrite');
  for (const name of SNAPSHOT_STORES) {
    const os = tx.objectStore(name);
    os.clear();
    for (const r of snapshot.stores[name] ?? []) os.put(r as object);
  }
  await txDone(tx);

  // Media: wipe, then one photo per transaction (iPhone Safari friendly).
  const wipe = db.transaction('media', 'readwrite');
  wipe.objectStore('media').clear();
  await txDone(wipe);
  const total = snapshot.media.length;
  let done = 0;
  onProgress?.(done, total);
  for (const m of snapshot.media) {
    const mtx = db.transaction('media', 'readwrite');
    mtx.objectStore('media').put(m);
    await txDone(mtx);
    done += 1;
    onProgress?.(done, total);
    await new Promise((r) => setTimeout(r, 0));
  }
}
