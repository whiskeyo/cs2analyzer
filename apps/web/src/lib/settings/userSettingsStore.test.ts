import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RADAR_GRAY,
  PARSE_POOL_MAX,
  RADAR_GRAY_MIN,
  SAVED_NOTES_PAGE_SIZE,
  SIDEBAR_DEFAULT_WIDTH,
} from "@/lib/shared/constants";
import { STORAGE_KEYS } from "@/lib/shared/storageKeys";
import {
  clearUserSettingsForTests,
  loadUserSettings,
  resetUserSettings,
  saveUserSettings,
} from "./userSettingsStore";
import { defaultUserSettings } from "./userSettings";

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

describe("userSettingsStore without indexedDB", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearUserSettingsForTests();
  });

  it("returns shipped defaults when nothing is stored", async () => {
    const loaded = await loadUserSettings();
    const defaults = defaultUserSettings(loaded.updatedAt);
    expect(loaded).toEqual(defaults);
  });

  it("round-trips a patch in memory", async () => {
    const saved = await saveUserSettings({
      sidebarWidth: 520,
      eventLeadInSec: 3,
    });
    expect(saved.sidebarWidth).toBe(520);
    expect(saved.eventLeadInSec).toBe(3);
    const loaded = await loadUserSettings();
    expect(loaded.sidebarWidth).toBe(520);
    expect(loaded.eventLeadInSec).toBe(3);
    expect(loaded.parsePoolMax).toBe(PARSE_POOL_MAX);
  });

  it("round-trips pdfTheme and reset restores dark", async () => {
    expect((await loadUserSettings()).pdfTheme).toBe("dark");
    await saveUserSettings({ pdfTheme: "light" });
    expect((await loadUserSettings()).pdfTheme).toBe("light");
    expect((await resetUserSettings()).pdfTheme).toBe("dark");
  });

  it("round-trips radarGray and reset restores full gray", async () => {
    expect((await loadUserSettings()).radarGray).toBe(DEFAULT_RADAR_GRAY);
    await saveUserSettings({ radarGray: RADAR_GRAY_MIN });
    expect((await loadUserSettings()).radarGray).toBe(RADAR_GRAY_MIN);
    expect((await resetUserSettings()).radarGray).toBe(DEFAULT_RADAR_GRAY);
  });

  it("keeps overlapping patches instead of last-write-wins on a stale load", async () => {
    await Promise.all([
      saveUserSettings({ seriesMaxFiles: 3 }),
      saveUserSettings({ eventLeadInSec: 3 }),
      saveUserSettings({ noteMomentSec: 8 }),
    ]);
    const loaded = await loadUserSettings();
    expect(loaded.seriesMaxFiles).toBe(3);
    expect(loaded.eventLeadInSec).toBe(3);
    expect(loaded.noteMomentSec).toBe(8);
  });

  it("reset restores shipped defaults without wiping the patch source", async () => {
    await saveUserSettings({ sidebarWidth: 560, savedNotesPageSize: 10 });
    const reset = await resetUserSettings();
    expect(reset.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(reset.savedNotesPageSize).toBe(SAVED_NOTES_PAGE_SIZE);
    expect(reset.pdfTheme).toBe("dark");
    expect(reset.radarGray).toBe(DEFAULT_RADAR_GRAY);
    expect((await loadUserSettings()).sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("applies live localStorage keys when memory is empty", async () => {
    stubLocalStorage({
      [STORAGE_KEYS.sidebarWidth]: "520",
      [STORAGE_KEYS.eventLeadInSec]: "2.5",
    });
    const loaded = await loadUserSettings();
    expect(loaded.sidebarWidth).toBe(520);
    expect(loaded.eventLeadInSec).toBe(2.5);
  });
});
