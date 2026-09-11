/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import {
  PROJECT_SCHEMA,
  countProjects,
  saveProject,
  type ReviewProject,
} from "@/lib/notes/projectStore";
import { countPlaybooks, createPlaybook } from "@/lib/playbook/playbookStore";
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH } from "@/lib/shared/constants";
import { STORAGE_KEYS } from "@/lib/shared/storageKeys";
import { openCs2Db, SETTINGS_STORE, requestOf } from "@/lib/storage/idb";
import {
  clearUserSettingsForTests,
  loadUserSettings,
  resetUserSettings,
  saveUserSettings,
} from "./userSettingsStore";
import { USER_SETTINGS_ID, defaultUserSettings } from "./userSettings";

function stubLocalStorage(entries: Record<string, string>): Map<string, string> {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  return store;
}

function project(): ReviewProject {
  return {
    schema: PROJECT_SCHEMA,
    key: "de_mirage|1|50,100|a.dem",
    savedAt: 1,
    fileName: "a.dem",
    mapName: "de_mirage",
    tick: 120,
    notes: [
      {
        round: 1,
        note: { groups: [], drawings: [], pieces: [], bookmarks: [] },
      },
    ],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
  };
}

describe("userSettingsStore indexedDB", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearUserSettingsForTests();
  });

  it("round-trips a save through IndexedDB", async () => {
    await saveUserSettings({
      sidebarWidth: 520,
      eventLeadInSec: 2,
      parsePoolMax: 2,
    });
    const loaded = await loadUserSettings();
    expect(loaded.sidebarWidth).toBe(520);
    expect(loaded.eventLeadInSec).toBe(2);
    expect(loaded.parsePoolMax).toBe(2);
    expect(loaded.defaultPaletteId).toBe("neon");
  });

  it("keeps overlapping patches instead of last-write-wins on a stale load", async () => {
    await Promise.all([
      saveUserSettings({ defaultPaletteId: "heat", defaultColor: "#ff7a00" }),
      saveUserSettings({ defaultFloorMode: "lower" }),
      saveUserSettings({ seriesMaxFiles: 3 }),
    ]);
    const loaded = await loadUserSettings();
    expect(loaded.defaultPaletteId).toBe("heat");
    expect(loaded.defaultColor).toBe("#ff7a00");
    expect(loaded.defaultFloorMode).toBe("lower");
    expect(loaded.seriesMaxFiles).toBe(3);
  });

  it("reset restores shipped defaults and leaves notes and playbooks", async () => {
    await saveProject(project());
    await createPlaybook("de_mirage", "Defaults");
    await saveUserSettings({ sidebarWidth: 560, eventLeadInSec: 4 });

    const reset = await resetUserSettings();
    expect(reset.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(reset.eventLeadInSec).toBe(defaultUserSettings().eventLeadInSec);
    expect((await loadUserSettings()).sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(await countProjects()).toBe(1);
    expect(await countPlaybooks()).toBe(1);
  });

  it("drops leftover localStorage keys when an IndexedDB row already exists", async () => {
    await saveUserSettings({ sidebarWidth: 520 });
    const store = stubLocalStorage({
      [STORAGE_KEYS.sidebarWidth]: String(SIDEBAR_MAX_WIDTH),
      [STORAGE_KEYS.eventLeadInSec]: "4",
    });
    const loaded = await loadUserSettings();
    expect(loaded.sidebarWidth).toBe(520);
    expect(store.get(STORAGE_KEYS.sidebarWidth)).toBeUndefined();
    expect(store.get(STORAGE_KEYS.eventLeadInSec)).toBeUndefined();
  });

  it("migrates sidebarWidth and eventLeadInSec once, then removes the keys", async () => {
    const store = stubLocalStorage({
      [STORAGE_KEYS.sidebarWidth]: "520",
      [STORAGE_KEYS.eventLeadInSec]: "2.5",
    });

    const first = await loadUserSettings();
    expect(first.sidebarWidth).toBe(520);
    expect(first.eventLeadInSec).toBe(2.5);
    expect(store.get(STORAGE_KEYS.sidebarWidth)).toBeUndefined();
    expect(store.get(STORAGE_KEYS.eventLeadInSec)).toBeUndefined();

    store.set(STORAGE_KEYS.sidebarWidth, String(SIDEBAR_MAX_WIDTH));
    store.set(STORAGE_KEYS.eventLeadInSec, "4");
    const second = await loadUserSettings();
    expect(second.sidebarWidth).toBe(520);
    expect(second.eventLeadInSec).toBe(2.5);
    expect(store.get(STORAGE_KEYS.sidebarWidth)).toBeUndefined();
    expect(store.get(STORAGE_KEYS.eventLeadInSec)).toBeUndefined();
  });

  it("does not persist a defaults row when localStorage has nothing to migrate", async () => {
    stubLocalStorage({});
    const loaded = await loadUserSettings();
    expect(loaded.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);

    const db = await openCs2Db();
    try {
      const tx = db.transaction(SETTINGS_STORE, "readonly");
      const row = await requestOf(tx.objectStore(SETTINGS_STORE).get(USER_SETTINGS_ID));
      expect(row).toBeUndefined();
    } finally {
      db.close();
    }

    stubLocalStorage({ [STORAGE_KEYS.sidebarWidth]: "560" });
    const migrated = await loadUserSettings();
    expect(migrated.sidebarWidth).toBe(560);
  });

  it("stores a single row keyed user", async () => {
    await saveUserSettings({ savedNotesPageSize: 8 });
    const db = await openCs2Db();
    try {
      const tx = db.transaction(SETTINGS_STORE, "readonly");
      const row = await requestOf(tx.objectStore(SETTINGS_STORE).get(USER_SETTINGS_ID));
      expect(row).toMatchObject({ id: "user", savedNotesPageSize: 8 });
    } finally {
      db.close();
    }
  });
});
