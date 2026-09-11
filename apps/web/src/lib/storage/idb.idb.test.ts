/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  DB_NAME,
  HANDLE_STORE,
  PLAYBOOK_STORE,
  PROJECT_STORE,
  SETTINGS_STORE,
  hasStore,
  idbAvailable,
  openCs2Db,
  requestOf,
} from "./idb";

function deleteCs2Db(): Promise<void> {
  const closing = indexedDB.deleteDatabase(DB_NAME);
  return new Promise((resolve, reject) => {
    closing.onsuccess = () => resolve();
    closing.onerror = () => reject(closing.error ?? new Error("deleteDatabase failed"));
    closing.onblocked = () => resolve();
  });
}

function openAtVersion(version: number, setup: (db: IDBDatabase) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => setup(req.result);
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

describe("openCs2Db", () => {
  it("adds playbooks when upgrading a v3 database", async () => {
    await deleteCs2Db();
    await openAtVersion(3, (db) => {
      db.createObjectStore(PROJECT_STORE, { keyPath: "key" });
      db.createObjectStore(HANDLE_STORE, { keyPath: "key" });
    });
    const db = await openCs2Db();
    try {
      expect(hasStore(db, PROJECT_STORE)).toBe(true);
      expect(hasStore(db, HANDLE_STORE)).toBe(true);
      expect(hasStore(db, PLAYBOOK_STORE)).toBe(true);
      expect(hasStore(db, SETTINGS_STORE)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("adds settings when upgrading a v4 database", async () => {
    await deleteCs2Db();
    await openAtVersion(4, (db) => {
      db.createObjectStore(PROJECT_STORE, { keyPath: "key" });
      db.createObjectStore(HANDLE_STORE, { keyPath: "key" });
      db.createObjectStore(PLAYBOOK_STORE, { keyPath: "key" });
    });
    const db = await openCs2Db();
    try {
      expect(hasStore(db, PLAYBOOK_STORE)).toBe(true);
      expect(hasStore(db, SETTINGS_STORE)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("is available and creates every store", async () => {
    expect(idbAvailable()).toBe(true);
    const db = await openCs2Db();
    try {
      expect(hasStore(db, PROJECT_STORE)).toBe(true);
      expect(hasStore(db, HANDLE_STORE)).toBe(true);
      expect(hasStore(db, PLAYBOOK_STORE)).toBe(true);
      expect(hasStore(db, SETTINGS_STORE)).toBe(true);
      expect(hasStore(db, "nope")).toBe(false);
    } finally {
      db.close();
    }
  });

  it("reopens without recreating stores", async () => {
    const first = await openCs2Db();
    first.close();
    const db = await openCs2Db();
    try {
      expect(hasStore(db, PLAYBOOK_STORE)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("wraps an IDB request in a promise", async () => {
    const db = await openCs2Db();
    try {
      const tx = db.transaction(PLAYBOOK_STORE, "readwrite");
      const store = tx.objectStore(PLAYBOOK_STORE);
      await requestOf(store.put({ key: "probe", title: "probe" }));
      const row = await requestOf(store.get("probe"));
      expect(row).toEqual({ key: "probe", title: "probe" });
      await requestOf(store.delete("probe"));
    } finally {
      db.close();
    }
  });

  it("rejects when the request fails", async () => {
    const req = {
      error: new DOMException("fail"),
      result: undefined,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const pending = requestOf(req as unknown as IDBRequest<unknown>);
    req.onerror?.();
    await expect(pending).rejects.toThrow("fail");
  });

  it("rejects with a fallback when the request has no error object", async () => {
    const req = {
      error: null,
      result: undefined,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const pending = requestOf(req as unknown as IDBRequest<unknown>);
    req.onerror?.();
    await expect(pending).rejects.toThrow("indexedDB request failed");
  });

  it("rejects when indexedDB.open fails", async () => {
    const orig = indexedDB.open.bind(indexedDB);
    indexedDB.open = (() => {
      const req = {
        result: undefined,
        error: new DOMException("open fail"),
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => req.onerror?.());
      return req as unknown as IDBOpenDBRequest;
    }) as typeof indexedDB.open;
    try {
      await expect(openCs2Db()).rejects.toThrow("open fail");
    } finally {
      indexedDB.open = orig;
    }
  });

  it("rejects with a fallback when open fails without an error object", async () => {
    const orig = indexedDB.open.bind(indexedDB);
    indexedDB.open = (() => {
      const req = {
        result: undefined,
        error: null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => req.onerror?.());
      return req as unknown as IDBOpenDBRequest;
    }) as typeof indexedDB.open;
    try {
      await expect(openCs2Db()).rejects.toThrow("indexedDB open failed");
    } finally {
      indexedDB.open = orig;
    }
  });
});
