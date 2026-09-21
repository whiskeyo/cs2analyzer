/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_TAG_STORE, openCs2Db, requestOf } from "@/lib/storage/idb";
import { TUTORIAL_FILENAME } from "@/lib/tutorial/identity";
import { loadAllDemoTags, loadDemoTags, saveDemoTags } from "./tagStore";

const KEY = "de_nuke|24|1,2|foo.dem";

async function clearTags(): Promise<void> {
  const db = await openCs2Db();
  try {
    const tx = db.transaction(DEMO_TAG_STORE, "readwrite");
    await requestOf(tx.objectStore(DEMO_TAG_STORE).clear());
  } finally {
    db.close();
  }
}

describe("demo tag store", () => {
  afterEach(async () => {
    await clearTags();
  });

  it("normalizes on save and reloads the same list", async () => {
    await saveDemoTags(KEY, ["#Nuke", "Come Back", "nuke"]);
    expect(await loadDemoTags(KEY)).toEqual(["nuke", "come-back"]);
    const all = await loadAllDemoTags();
    expect(all.get(KEY)).toEqual(["nuke", "come-back"]);
  });

  it("deletes the row when the list is cleared", async () => {
    await saveDemoTags(KEY, ["comeback"]);
    await saveDemoTags(KEY, []);
    expect(await loadDemoTags(KEY)).toEqual([]);
    expect((await loadAllDemoTags()).size).toBe(0);
  });

  it("normalizes a raw indexedDB row on read", async () => {
    const db = await openCs2Db();
    try {
      const tx = db.transaction(DEMO_TAG_STORE, "readwrite");
      await requestOf(
        tx.objectStore(DEMO_TAG_STORE).put({
          key: KEY,
          tags: ["  ECO Round ", 4, "eco-round"],
        }),
      );
    } finally {
      db.close();
    }
    expect(await loadDemoTags(KEY)).toEqual(["eco-round"]);
  });

  it("does not persist tutorial fixture keys", async () => {
    const key = `de_mirage|2|1|${TUTORIAL_FILENAME}`;
    await saveDemoTags(key, ["nuke"]);
    expect(await loadDemoTags(key)).toEqual([]);
    expect((await loadAllDemoTags()).size).toBe(0);
  });
});
