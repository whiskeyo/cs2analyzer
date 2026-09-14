import { getPlaybookImageBlob } from "@/lib/playbook/playbookImageStore";
import {
  HANDLE_STORE,
  PLAYBOOK_IMAGE_STORE,
  PLAYBOOK_STORE,
  PROJECT_STORE,
  SETTINGS_STORE,
  hasStore,
  idbAvailable,
  openCs2Db,
} from "./idb";
import { wrapIdbError } from "./quota";

const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
const BOOLEAN_BYTES = 1;
const NUMBER_BYTES = 8;

export const STORAGE_CATEGORY_IDS = ["notes", "playbooks", "photos", "settings", "other"] as const;

export type StorageCategoryId = (typeof STORAGE_CATEGORY_IDS)[number];

export const STORAGE_CATEGORY_LABELS: Record<StorageCategoryId, string> = {
  notes: "Analyzer notes",
  playbooks: "Playbooks",
  photos: "Photos",
  settings: "Settings",
  other: "Other",
};

const STORE_CATEGORY: Record<string, StorageCategoryId> = {
  [PROJECT_STORE]: "notes",
  [PLAYBOOK_STORE]: "playbooks",
  [PLAYBOOK_IMAGE_STORE]: "photos",
  [SETTINGS_STORE]: "settings",
  [HANDLE_STORE]: "other",
};

export interface StorageCategoryUsage {
  id: StorageCategoryId;
  label: string;
  bytes: number;
}

export interface Cs2DatabaseUsage {
  categories: StorageCategoryUsage[];
  totalBytes: number;
}

export interface StorageEstimateLike {
  usage?: number;
  quota?: number;
}

export interface StorageManagerLike {
  estimate?: () => Promise<StorageEstimateLike>;
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export interface OriginStorageEstimate {
  usageBytes: number | null;
  quotaBytes: number | null;
  persisted: boolean | null;
  persistSupported: boolean;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function isBlobLike(value: unknown): value is { size: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { size?: unknown }).size === "number" &&
    Number.isFinite((value as { size: number }).size) &&
    (value as { size: number }).size >= 0 &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/**
 * fake-indexeddb (and some structured clones) store Blobs as `{}`.
 * The playbook image cache still holds the real bytes — look those up later.
 */
export function playbookImageFallbackId(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as { id?: unknown; blob?: unknown };
  if (typeof rec.id !== "string" || rec.id.length === 0) return null;
  if (rec.blob instanceof Blob || isBlobLike(rec.blob)) return null;
  return rec.id;
}

/** Approximate on-disk size of an IndexedDB value (blobs by `size`, else a walk). */
export function valueByteSize(value: unknown, seen = new WeakSet<object>()): number {
  if (value == null) return 0;
  if (typeof value === "boolean") return BOOLEAN_BYTES;
  if (typeof value === "number" || typeof value === "bigint") return NUMBER_BYTES;
  if (typeof value === "string") return utf8Bytes(value);
  if (typeof value !== "object") return 0;
  if (seen.has(value)) return 0;
  seen.add(value);
  if (value instanceof Blob || isBlobLike(value)) return value.size;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (value instanceof Date) return NUMBER_BYTES;
  if (Array.isArray(value)) {
    let n = 0;
    for (const item of value) n += valueByteSize(item, seen);
    return n;
  }
  let n = 0;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    n += utf8Bytes(key) + valueByteSize(child, seen);
  }
  return n;
}

export function emptyCs2DatabaseUsage(): Cs2DatabaseUsage {
  const categories = STORAGE_CATEGORY_IDS.map((id) => ({
    id,
    label: STORAGE_CATEGORY_LABELS[id],
    bytes: 0,
  }));
  return { categories, totalBytes: 0 };
}

export function categoryForStore(storeName: string): StorageCategoryId {
  return STORE_CATEGORY[storeName] ?? "other";
}

export function categoryBarPercents(categories: readonly StorageCategoryUsage[]): number[] {
  const total = categories.reduce((sum, row) => sum + row.bytes, 0);
  if (total <= 0) return categories.map(() => 0);
  return categories.map((row) => (row.bytes / total) * 100);
}

/** One decimal under 10 MB so a small notes row is not "0 MB". */
export function formatMegabytes(bytes: number): string {
  const mib = bytes / BYTES_PER_MIB;
  if (mib >= 10) return String(Math.round(mib));
  return mib.toFixed(1);
}

export function formatUsageMegabytes(usedBytes: number, quotaBytes: number | null): string {
  if (quotaBytes == null || quotaBytes <= 0) {
    return `${formatMegabytes(usedBytes)} MB`;
  }
  return `${formatMegabytes(usedBytes)} / ${formatMegabytes(quotaBytes)} MB`;
}

export function formatLocalDatabaseUsageLabel(
  usedBytes: number,
  quotaBytes: number | null,
): string {
  return `Local database usage: ${formatUsageMegabytes(usedBytes, quotaBytes)}`;
}

function navigatorStorage(): StorageManagerLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.storage as StorageManagerLike | undefined;
}

export async function readOriginStorageEstimate(
  storage: StorageManagerLike | undefined = navigatorStorage(),
): Promise<OriginStorageEstimate> {
  const persistSupported = typeof storage?.persist === "function";
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  let persisted: boolean | null = null;
  if (typeof storage?.estimate === "function") {
    try {
      const estimate = await storage.estimate();
      if (typeof estimate.usage === "number" && Number.isFinite(estimate.usage)) {
        usageBytes = estimate.usage;
      }
      if (
        typeof estimate.quota === "number" &&
        Number.isFinite(estimate.quota) &&
        estimate.quota > 0
      ) {
        quotaBytes = estimate.quota;
      }
    } catch {
      /* private mode / missing StorageManager */
    }
  }
  if (typeof storage?.persisted === "function") {
    try {
      persisted = await storage.persisted();
    } catch {
      persisted = null;
    }
  }
  return { usageBytes, quotaBytes, persisted, persistSupported };
}

/** Pages cannot raise origin quota. `persist()` only asks the browser not to evict. */
export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = navigatorStorage(),
): Promise<boolean | null> {
  if (typeof storage?.persist !== "function") return null;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}

function readStoreValues(store: IDBObjectStore): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const rows: unknown[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(rows);
        return;
      }
      rows.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(wrapIdbError(req.error ?? new Error("indexedDB cursor failed")));
  });
}

export async function measureCs2DatabaseUsage(): Promise<Cs2DatabaseUsage> {
  const usage = emptyCs2DatabaseUsage();
  if (!idbAvailable()) return usage;
  const byId = new Map(usage.categories.map((row) => [row.id, row]));
  const photoFallbackIds: string[] = [];
  const db = await openCs2Db();
  try {
    const names = [...db.objectStoreNames];
    if (names.length === 0) return usage;
    const tx = db.transaction(names, "readonly");
    for (const name of names) {
      if (!hasStore(db, name)) continue;
      const rows = await readStoreValues(tx.objectStore(name));
      let bytes = 0;
      for (const row of rows) {
        bytes += valueByteSize(row);
        if (name === PLAYBOOK_IMAGE_STORE) {
          const id = playbookImageFallbackId(row);
          if (id) photoFallbackIds.push(id);
        }
      }
      const category = byId.get(categoryForStore(name));
      if (category) category.bytes += bytes;
    }
  } finally {
    db.close();
  }
  if (photoFallbackIds.length > 0) {
    const photos = byId.get("photos");
    if (photos) {
      for (const id of photoFallbackIds) {
        const live = await getPlaybookImageBlob(id);
        if (live) photos.bytes += live.size;
      }
    }
  }
  usage.totalBytes = usage.categories.reduce((sum, row) => sum + row.bytes, 0);
  return usage;
}
