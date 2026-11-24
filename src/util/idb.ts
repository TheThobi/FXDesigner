/**
 * Minimal IndexedDB store of JSON-like records keyed by string: a disposable cache (it
 * never throws; everything degrades to "not cached" when IndexedDB is unavailable). Keeps
 * big caches out of localStorage, whose small quota belongs to the library.
 */
export class IdbStore<T> {
  private db: Promise<IDBDatabase | null> | null = null;

  constructor(
    private readonly dbName: string,
    private readonly storeName: string,
  ) {}

  /** Every record, by key. */
  async all(): Promise<Map<string, T>> {
    const out = new Map<string, T>();
    const db = await this.open();
    if (!db) return out;
    return new Promise((resolve) => {
      try {
        const request = db.transaction(this.storeName).objectStore(this.storeName).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return resolve(out);
          out.set(String(cursor.key), cursor.value as T);
          cursor.continue();
        };
        request.onerror = () => resolve(out);
      } catch {
        resolve(out);
      }
    });
  }

  async put(key: string, value: T): Promise<void> {
    const db = await this.open();
    if (!db) return;
    try {
      db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(value, key);
    } catch {
      // Best effort (quota, closed database).
    }
  }

  private open(): Promise<IDBDatabase | null> {
    this.db ??= new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.db;
  }
}
