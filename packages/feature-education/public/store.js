/**
 * Tiny promise wrapper over IndexedDB — all learner data lives here first,
 * so the app works fully offline.
 *
 * Stores
 *   modules  keyPath id       — downloaded learning modules
 *   events   keyPath eventId  — the full review log (this device + synced from others)
 *   outbox   keyPath eventId  — reviews not yet acknowledged by the server
 *   meta     keyPath key      — learnerId, deviceId, cursor, enrolled modules
 */

const DB_NAME = 'microlearning';
const DB_VERSION = 1;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openStore() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('modules')) db.createObjectStore('modules', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'eventId' });
    if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'eventId' });
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
  };
  const db = await promisify(req);

  function tx(stores, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result;
      Promise.resolve(fn(t)).then((r) => (result = r), reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
    });
  }

  return {
    getAll: (store) => tx([store], 'readonly', (t) => promisify(t.objectStore(store).getAll())),
    putMany: (store, values) =>
      tx([store], 'readwrite', (t) => {
        const os = t.objectStore(store);
        for (const v of values) os.put(v);
      }),
    deleteMany: (store, keys) =>
      tx([store], 'readwrite', (t) => {
        const os = t.objectStore(store);
        for (const k of keys) os.delete(k);
      }),
    /** Record a review in the log and the outbox atomically. */
    recordReview: (event) =>
      tx(['events', 'outbox'], 'readwrite', (t) => {
        t.objectStore('events').put(event);
        t.objectStore('outbox').put(event);
      }),
    getMeta: async (key, fallback = undefined) => {
      const row = await tx(['meta'], 'readonly', (t) => promisify(t.objectStore('meta').get(key)));
      return row ? row.value : fallback;
    },
    setMeta: (key, value) => tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ key, value })),
    clearAll: () =>
      tx(['modules', 'events', 'outbox', 'meta'], 'readwrite', (t) => {
        for (const s of ['modules', 'events', 'outbox', 'meta']) t.objectStore(s).clear();
      }),
  };
}
