/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("playbookStore indexedDB", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
  });

  it("saves, loads, and lists books for a map", async () => {
    const older = await createPlaybook("de_mirage", "Defaults");
    const newer = await savePlaybook({
      ...newPlaybook("de_mirage", "A execs"),
      savedAt: Date.now() + 10,
    });
    await createPlaybook("de_inferno", "Other");

    expect(await countPlaybooks()).toBe(3);
    const loaded = await loadPlaybook(older.key);
    expect(loaded?.title).toBe("Defaults");
    expect(loaded?.pages[0]?.title).toBeDefined();

    const mirage = await listPlaybooksForMap("de_mirage");
    expect(mirage.map((b) => b.title)).toEqual(["A execs", "Defaults"]);
    expect(newer.key).toBe(mirage[0]?.key);
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

  it("skips malformed rows and sorts equal timestamps by title", async () => {
    const zulu = { ...newPlaybook("de_mirage", "Zulu"), savedAt: 50 };
    const alpha = { ...newPlaybook("de_mirage", "Alpha"), savedAt: 50 };
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
    expect(all.map((book) => book.title)).toEqual(["Alpha", "Zulu"]);
  });
});
