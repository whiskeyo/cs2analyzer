export const DB_NAME = "cs2analyzer";
export const DB_VERSION = 6;

export const PROJECT_STORE = "projects";
export const HANDLE_STORE = "demoHandles";
export const PLAYBOOK_STORE = "playbooks";
export const PLAYBOOK_IMAGE_STORE = "playbookImages";
export const SETTINGS_STORE = "settings";

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function requestOf<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

function ensureStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(PROJECT_STORE)) {
    db.createObjectStore(PROJECT_STORE, { keyPath: "key" });
  }
  if (!db.objectStoreNames.contains(HANDLE_STORE)) {
    db.createObjectStore(HANDLE_STORE, { keyPath: "key" });
  }
  if (!db.objectStoreNames.contains(PLAYBOOK_STORE)) {
    db.createObjectStore(PLAYBOOK_STORE, { keyPath: "key" });
  }
  if (!db.objectStoreNames.contains(PLAYBOOK_IMAGE_STORE)) {
    db.createObjectStore(PLAYBOOK_IMAGE_STORE, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
    db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
  }
}

export function openCs2Db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      ensureStores(req.result);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

export function hasStore(db: IDBDatabase, name: string): boolean {
  return db.objectStoreNames.contains(name);
}
