/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { openCs2Db, PLAYBOOK_STORE, requestOf } from "@/lib/storage/idb";
import {
  countPlaybooks,
  createPlaybook,
  deleteAllPlaybooks,
  deletePlaybook,
  listPlaybooksForMap,
  loadAllPlaybooks,
  loadPlaybook,
  savePlaybook,
} from "./playbookStore";
import { newPlaybook } from "./pages";
import { PLAYBOOK_SCHEMA } from "./types";

describe("playbookStore indexedDB", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
    await clearUserSettingsForTests();
  });

  it("saves, loads, and lists books in creation order", async () => {
    const older = await createPlaybook("de_mirage", "Defaults");
    const newer = await createPlaybook("de_mirage", "A execs");
    await savePlaybook({ ...newer, savedAt: Date.now() + 10_000 });
    await createPlaybook("de_inferno", "Other");

    expect(await countPlaybooks()).toBe(3);
    const loaded = await loadPlaybook(older.key);
    expect(loaded?.title).toBe("Defaults");
    expect(loaded?.pages[0]?.title).toBeDefined();

    const mirage = await listPlaybooksForMap("de_mirage");
    expect(mirage.map((b) => b.title)).toEqual(["Defaults", "A execs"]);
    expect(older.key).toBe(mirage[0]?.key);
    expect(await loadPlaybook("missing")).toBeNull();
  });

  it("deletes one book and wipes the store", async () => {
    const a = await createPlaybook("de_mirage", "A");
    const b = await createPlaybook("de_mirage", "B");
    await deletePlaybook(a.key);
    expect(await countPlaybooks()).toBe(1);
    expect(await loadPlaybook(a.key)).toBeNull();
    expect((await loadPlaybook(b.key))?.title).toBe("B");
    expect(await deleteAllPlaybooks()).toBe(1);
    expect(await countPlaybooks()).toBe(0);
    expect(await deleteAllPlaybooks()).toBe(0);
  });

  it("skips malformed rows and orders by sort, then title", async () => {
    const zulu = { ...newPlaybook("de_mirage", "Zulu"), savedAt: 50, sort: 0 };
    const alpha = {
      ...newPlaybook("de_mirage", "Alpha"),
      savedAt: 50,
      sort: 1,
    };
    const db = await openCs2Db();
    try {
      const tx = db.transaction(PLAYBOOK_STORE, "readwrite");
      const store = tx.objectStore(PLAYBOOK_STORE);
      await requestOf(store.put(zulu));
      await requestOf(store.put(alpha));
      await requestOf(store.put({ key: "junk", schema: 0 }));
    } finally {
      db.close();
    }
    const all = await loadAllPlaybooks();
    expect(all.map((book) => book.title)).toEqual(["Zulu", "Alpha"]);
  });

  it("migrates a schema 1 row and keeps videos empty", async () => {
    const book = newPlaybook("de_mirage", "Legacy");
    const first = book.pages[0]!;
    const db = await openCs2Db();
    try {
      const tx = db.transaction(PLAYBOOK_STORE, "readwrite");
      await requestOf(
        tx.objectStore(PLAYBOOK_STORE).put({
          ...book,
          schema: 1,
          pages: [
            {
              id: first.id,
              title: first.title,
              body: first.body,
              floor: first.floor,
              note: first.note,
            },
          ],
        }),
      );
    } finally {
      db.close();
    }
    const loaded = await loadPlaybook(book.key);
    expect(loaded?.schema).toBe(PLAYBOOK_SCHEMA);
    expect(loaded?.pages[0]?.videos).toEqual([]);
    expect(loaded?.pages[0]?.images).toEqual([]);
    expect(loaded?.pages[0]?.lowerImages).toEqual([]);
    expect(loaded?.title).toBe("Legacy");
  });

  it("seeds a new book from Preferences drawing colors", async () => {
    const night = COLOR_PRESETS.find((row) => row.id === "night");
    await saveUserSettings({
      defaultPaletteId: "night",
      defaultColor: night?.colors[0],
    });
    const book = await createPlaybook("de_mirage", "Night book");
    expect(book.paletteId).toBe("night");
    expect(book.color).toBe(night?.colors[0]);
  });
});
