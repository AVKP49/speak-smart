/**
 * Local-first persistence (spec §9.1). All state lives in IndexedDB on the device.
 * No account, no server round-trips. Falls back to memory if IndexedDB is missing.
 */

const DB_NAME = "speak-smart";
const DB_VERSION = 1;

type StoreName = "kv" | "packs" | "arsenal";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
        if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs", { keyPath: "id" });
        if (!db.objectStoreNames.contains("arsenal")) db.createObjectStore("arsenal", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const memory: Record<StoreName, Map<string, unknown>> = {
  kv: new Map(),
  packs: new Map(),
  arsenal: new Map(),
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    void db().then((database) => {
      if (!database) {
        reject(new Error("no-idb"));
        return;
      }
      try {
        const transaction = database.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("idb-error"));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("idb-error"));
      }
    });
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const row = await tx<{ key: string; value: T }>("kv", "readonly", (s) => s.get(key));
    return row?.value;
  } catch {
    return memory.kv.get(key) as T | undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.kv.set(key, value);
  try {
    await tx("kv", "readwrite", (s) => s.put({ key, value }));
  } catch {
    /* memory fallback already updated */
  }
}

export async function kvDel(key: string): Promise<void> {
  memory.kv.delete(key);
  try {
    await tx("kv", "readwrite", (s) => s.delete(key));
  } catch {
    /* noop */
  }
}

async function storeOp<T>(
  store: Exclude<StoreName, "kv">,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await db();
  if (!database) throw new Error("no-idb");
  return new Promise<T>((resolve, reject) => {
    try {
      const transaction = database.transaction(store, mode);
      const request = run(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error("idb-error"));
    } catch (err) {
      reject(err instanceof Error ? err : new Error("idb-error"));
    }
  });
}

export async function recordGet<T>(store: Exclude<StoreName, "kv">, key: string): Promise<T | undefined> {
  try {
    return await storeOp<T | undefined>(store, "readonly", (s) => s.get(key));
  } catch {
    return memory[store].get(key) as T | undefined;
  }
}

export async function recordPut(store: Exclude<StoreName, "kv">, value: Record<string, unknown>): Promise<void> {
  const key = value["key"] ?? value["id"];
  if (typeof key === "string") memory[store].set(key, value);
  try {
    await storeOp(store, "readwrite", (s) => s.put(value));
  } catch {
    /* memory fallback already updated */
  }
}

export async function recordAll<T>(store: Exclude<StoreName, "kv">): Promise<T[]> {
  try {
    return await storeOp<T[]>(store, "readonly", (s) => s.getAll());
  } catch {
    return [...memory[store].values()] as T[];
  }
}

export async function recordDelete(store: Exclude<StoreName, "kv">, key: string): Promise<void> {
  memory[store].delete(key);
  try {
    await storeOp(store, "readwrite", (s) => s.delete(key));
  } catch {
    /* noop */
  }
}

export async function clearAll(): Promise<void> {
  for (const store of ["kv", "packs", "arsenal"] as const) {
    memory[store].clear();
    try {
      await storeOp(store === "kv" ? "packs" : store, "readwrite", () => {
        throw new Error("skip");
      });
    } catch {
      /* handled per-store below */
    }
  }
  const database = await db();
  if (database) {
    for (const store of ["kv", "packs", "arsenal"] as const) {
      await new Promise<void>((resolve) => {
        try {
          const t = database.transaction(store, "readwrite");
          t.objectStore(store).clear();
          t.oncomplete = () => resolve();
          t.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }
}
