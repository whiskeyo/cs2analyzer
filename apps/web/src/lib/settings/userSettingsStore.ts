import { loadLeadInSec } from "@/lib/match/roundEvents";
import { loadHabitsTrailWindowSec } from "@/lib/parse/seriesOverlay";
import { loadSidebarWidth } from "@/lib/shared/sidebarWidth";
import { STORAGE_KEYS } from "@/lib/shared/storageKeys";
import { SETTINGS_STORE, hasStore, idbAvailable, openCs2Db, requestOf } from "@/lib/storage/idb";
import { isQuotaExceededError, wrapIdbError } from "@/lib/storage/quota";
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

/** Keep load/merge/write atomic so rapid Preferences edits do not drop patches. */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(work, work);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

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
    if (localStorage.getItem(STORAGE_KEYS.seriesTrailWindowSec) != null) {
      patch.habitsTrailWindowSec = loadHabitsTrailWindowSec();
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
  return (
    patch.sidebarWidth != null || patch.eventLeadInSec != null || patch.habitsTrailWindowSec != null
  );
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

function clearMigratedLocalStorage(): void {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.sidebarWidth);
    localStorage.removeItem(STORAGE_KEYS.eventLeadInSec);
    localStorage.removeItem(STORAGE_KEYS.seriesTrailWindowSec);
  } catch {
    /* private mode / missing storage */
  }
}

/** @returns true when the IndexedDB row is the source of truth. */
async function persist(settings: UserSettings): Promise<boolean> {
  if (!idbAvailable()) {
    memoryFallback = cloneUserSettings(settings);
    return false;
  }
  try {
    await writeRecord(settings);
    memoryFallback = null;
    return true;
  } catch (err) {
    memoryFallback = cloneUserSettings(settings);
    if (isQuotaExceededError(err)) {
      throw wrapIdbError(err);
    }
    return false;
  }
}

/**
 * Load the user settings document. Missing IndexedDB row: merge live
 * `sidebarWidth` / `eventLeadInSec` / `seriesTrailWindowSec` localStorage
 * (once, then persist). After a successful IndexedDB write, those keys are
 * removed.
 */
export async function loadUserSettings(): Promise<UserSettings> {
  if (memoryFallback) {
    return cloneUserSettings(memoryFallback);
  }
  if (!idbAvailable()) {
    memoryFallback = mergeLocalStorage(defaultUserSettings());
    return cloneUserSettings(memoryFallback);
  }
  try {
    const raw = await readRecord();
    if (raw != null && isRecord(raw)) {
      clearMigratedLocalStorage();
      return parseUserSettings(raw);
    }
    const patch = readLocalStoragePatch();
    const settings = mergeLocalStorage(defaultUserSettings());
    if (localStoragePatchPresent(patch) && (await persist(settings))) {
      clearMigratedLocalStorage();
    }
    return settings;
  } catch {
    return cloneUserSettings(memoryFallback ?? mergeLocalStorage(defaultUserSettings()));
  }
}

export async function saveUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  return enqueueWrite(async () => {
    const current = await loadUserSettings();
    const next = parseUserSettings({
      ...current,
      ...patch,
      schema: USER_SETTINGS_SCHEMA,
      updatedAt: Date.now(),
    });
    if (await persist(next)) {
      clearMigratedLocalStorage();
    }
    return cloneUserSettings(next);
  });
}

/** Restores shipped defaults. Does not delete notes, handles, or playbooks. */
export async function resetUserSettings(): Promise<UserSettings> {
  return enqueueWrite(async () => {
    const next = defaultUserSettings();
    if (await persist(next)) {
      clearMigratedLocalStorage();
    }
    return cloneUserSettings(next);
  });
}

/** Test helper: drop the in-memory fallback and the IndexedDB row. */
export async function clearUserSettingsForTests(): Promise<void> {
  return enqueueWrite(async () => {
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
  });
}
