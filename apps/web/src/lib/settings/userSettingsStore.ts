import { loadLeadInSec } from "@/lib/match/roundEvents";
import { loadSidebarWidth } from "@/lib/shared/sidebarWidth";
import { STORAGE_KEYS } from "@/lib/shared/storageKeys";
import { SETTINGS_STORE, hasStore, idbAvailable, openCs2Db, requestOf } from "@/lib/storage/idb";
import { isRecord } from "@/lib/validate/guards.ts";
import {
  USER_SETTINGS_ID,
  USER_SETTINGS_SCHEMA,
  cloneUserSettings,
  defaultUserSettings,
  parseUserSettings,
  type UserSettings,
  type UserSettingsRecord,
} from "./userSettings";

/** In-memory copy when IndexedDB is missing or a write fails. */
let memoryFallback: UserSettings | null = null;

function readLocalStoragePatch(): Partial<UserSettings> {
  const patch: Partial<UserSettings> = {};
  try {
    if (typeof localStorage === "undefined") {
      return patch;
    }
    if (localStorage.getItem(STORAGE_KEYS.sidebarWidth) != null) {
      patch.sidebarWidth = loadSidebarWidth();
    }
    if (localStorage.getItem(STORAGE_KEYS.eventLeadInSec) != null) {
      patch.eventLeadInSec = loadLeadInSec();
    }
  } catch {
    /* private mode / missing storage */
  }
  return patch;
}

function mergeLocalStorage(base: UserSettings): UserSettings {
  return parseUserSettings({ ...base, ...readLocalStoragePatch() });
}

function localStoragePatchPresent(patch: Partial<UserSettings>): boolean {
  return patch.sidebarWidth != null || patch.eventLeadInSec != null;
}

async function readRecord(): Promise<unknown> {
  const db = await openCs2Db();
  try {
    if (!hasStore(db, SETTINGS_STORE)) {
      return undefined;
    }
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    return await requestOf(tx.objectStore(SETTINGS_STORE).get(USER_SETTINGS_ID));
  } finally {
    db.close();
  }
}

async function writeRecord(settings: UserSettings): Promise<void> {
  const record: UserSettingsRecord = { id: USER_SETTINGS_ID, ...settings };
  const db = await openCs2Db();
  try {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    await requestOf(tx.objectStore(SETTINGS_STORE).put(record));
  } finally {
    db.close();
  }
}

async function persist(settings: UserSettings): Promise<void> {
  if (!idbAvailable()) {
    memoryFallback = cloneUserSettings(settings);
    return;
  }
  try {
    await writeRecord(settings);
    memoryFallback = null;
  } catch {
    memoryFallback = cloneUserSettings(settings);
  }
}

/**
 * Load the user settings document. Missing IndexedDB row: merge live
 * `sidebarWidth` / `eventLeadInSec` localStorage (once, then persist).
 * Those keys stay in localStorage until a later PR wires the UI.
 */
export async function loadUserSettings(): Promise<UserSettings> {
  if (!idbAvailable()) {
    if (memoryFallback) {
      return cloneUserSettings(memoryFallback);
    }
    memoryFallback = mergeLocalStorage(defaultUserSettings());
    return cloneUserSettings(memoryFallback);
  }
  try {
    const raw = await readRecord();
    if (raw != null && isRecord(raw)) {
      return parseUserSettings(raw);
    }
    const patch = readLocalStoragePatch();
    const settings = mergeLocalStorage(defaultUserSettings());
    if (localStoragePatchPresent(patch)) {
      await persist(settings);
    }
    return settings;
  } catch {
    return cloneUserSettings(memoryFallback ?? mergeLocalStorage(defaultUserSettings()));
  }
}

export async function saveUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await loadUserSettings();
  const next = parseUserSettings({
    ...current,
    ...patch,
    schema: USER_SETTINGS_SCHEMA,
    updatedAt: Date.now(),
  });
  await persist(next);
  return cloneUserSettings(next);
}

/** Restores shipped defaults. Does not delete notes, handles, or playbooks. */
export async function resetUserSettings(): Promise<UserSettings> {
  const next = defaultUserSettings();
  await persist(next);
  return cloneUserSettings(next);
}

/** Test helper: drop the in-memory fallback and the IndexedDB row. */
export async function clearUserSettingsForTests(): Promise<void> {
  memoryFallback = null;
  if (!idbAvailable()) {
    return;
  }
  const db = await openCs2Db();
  try {
    if (!hasStore(db, SETTINGS_STORE)) {
      return;
    }
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    await requestOf(tx.objectStore(SETTINGS_STORE).delete(USER_SETTINGS_ID));
  } finally {
    db.close();
  }
}
