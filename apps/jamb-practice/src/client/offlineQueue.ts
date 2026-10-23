'use client';

import { api, track } from './api';

// Answers made offline wait in IndexedDB and are sent when the connection
// returns. The server is idempotent by clientId, so resending is safe.

type Pending = {
  clientId: string;
  day: number;
  body: { questionId: string; selectedOption: string; timeMs?: number; clientId: string; attemptNo: number };
};

const DB = 'jp-offline';
const STORE = 'answers';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'clientId' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(p: Pending) {
  try {
    await tx('readwrite', (s) => s.put(p));
  } catch {
    /* storage blocked: the answer still shows locally */
  }
}

export async function pendingCount(): Promise<number> {
  try {
    return await tx('readonly', (s) => s.count());
  } catch {
    return 0;
  }
}

let flushing = false;

/** Sends queued answers. Returns how many were synced. */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    const all = await tx<Pending[]>('readonly', (s) => s.getAll() as IDBRequest<Pending[]>);
    for (const p of all) {
      const r = await api(`/api/lessons/${p.day}/answer`, { body: p.body });
      // Drop on success or on a permanent refusal; keep on network errors.
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) {
        await tx('readwrite', (s) => s.delete(p.clientId));
        if (r.ok) synced++;
      } else break;
    }
  } catch {
    /* try again later */
  } finally {
    flushing = false;
  }
  if (synced) track('offline_queue_flushed', { count: synced });
  return synced;
}

export async function clearQueue() {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* nothing to clear */
  }
}
