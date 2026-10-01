// keeps the last import in the browser (IndexedDB), so a reload of the page still has the data
// localStorage is too small for it, the result has several MB. nothing leaves the browser.
// every function resolves even when IndexedDB is missing or fails (private mode, full disk, node),
// then the data is just not kept

const DB_NAME = "flux";
const DB_VERSION = 1;
const STORE = "saved";

// "data" = the ImportResult of lib/data-store, "import" = file list and summary of the import page
export type SavedKey = "data" | "import";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let db: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  db ??= new Promise<IDBDatabase | null>((resolve) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => resolve(null);
    open.onblocked = () => resolve(null);
  });
  return db;
}

// runs one request on the store, null if IndexedDB is not there or the request fails
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  try {
    const database = await openDb();
    if (!database) return null;
    const transaction = database.transaction(STORE, mode);
    // a write only counts once the transaction is done
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const result = await request(run(transaction.objectStore(STORE)));
    await done;
    return result;
  } catch {
    return null;
  }
}

export async function saveData<T>(key: SavedKey, value: T): Promise<void> {
  await withStore("readwrite", (store) => store.put(value, key));
}

export async function loadData<T>(key: SavedKey): Promise<T | null> {
  return ((await withStore("readonly", (store) => store.get(key))) ??
    null) as T | null;
}

export async function deleteData(key: SavedKey): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}

export async function clearSavedData(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}
