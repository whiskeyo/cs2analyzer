/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "./palettes";
import { PROJECT_STORE, openCs2Db, requestOf } from "@/lib/storage/idb";
import {
  countProjects,
  deleteAllProjects,
  deleteProject,
  loadAllProjects,
  loadProject,
  saveProject,
  type ReviewProject,
} from "./projectStore";
import { DEFAULT_SUMMARY_FILTER } from "./types";

function project(partial: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: 2,
    key: "de_mirage|1|50,100|a.dem",
    savedAt: 1,
    fileName: "a.dem",
    mapName: "de_mirage",
    tick: 120,
    notes: [
      {
        round: 1,
        note: {
          groups: [],
          drawings: [
            { type: "arrow", color: "#ff1744", from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
          ],
          pieces: [],
          bookmarks: [],
        },
      },
    ],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
    ...partial,
  };
}

describe("projectStore indexedDB", () => {
  beforeEach(async () => {
    await deleteAllProjects();
  });

  afterEach(async () => {
    await deleteAllProjects();
  });

  it("saves and loads a project by key", async () => {
    const row = project();
    await saveProject(row);
    const loaded = await loadProject(row.key);
    expect(loaded?.key).toBe(row.key);
    expect(loaded?.notes[0]?.note.drawings[0]?.type).toBe("arrow");
    expect(loaded && "strokes" in loaded).toBe(false);
    expect(loaded?.savedAt).toBeGreaterThanOrEqual(row.savedAt);
  });

  it("returns null for a missing key", async () => {
    expect(await loadProject("missing")).toBeNull();
  });

  it("lists every saved project", async () => {
    const a = project({ key: "a", savedAt: 10 });
    const b = project({ key: "b", savedAt: 20, fileName: "b.dem" });
    await saveProject(a);
    await saveProject(b);
    const all = await loadAllProjects();
    expect(all.map((p) => p.key).sort()).toEqual(["a", "b"]);
  });

  it("counts projects and deletes one row", async () => {
    await saveProject(project({ key: "one" }));
    await saveProject(project({ key: "two", fileName: "two.dem" }));
    expect(await countProjects()).toBe(2);

    await deleteProject("one");
    expect(await countProjects()).toBe(1);
    expect(await loadProject("one")).toBeNull();
    const two = await loadProject("two");
    expect(two?.key).toBe("two");
  });

  it("wipes every saved project", async () => {
    await saveProject(project({ key: "one" }));
    await saveProject(project({ key: "two", fileName: "two.dem" }));
    expect(await deleteAllProjects()).toBe(2);
    expect(await countProjects()).toBe(0);
    expect(await loadAllProjects()).toEqual([]);
  });

  it("returns zero when the store is already empty", async () => {
    expect(await deleteAllProjects()).toBe(0);
    expect(await countProjects()).toBe(0);
  });

  it("refuses to save tutorial fixture notes and purges stale rows", async () => {
    const real = project({
      key: "de_dust2|24|1|b8-vs-spirit-m1-dust2.dem",
      fileName: "b8-vs-spirit-m1-dust2.dem",
    });
    const tutorial = project({
      key: "de_mirage|2|1|tutorial.dem",
      fileName: "tutorial.dem",
    });
    const series = project({
      key: "de_dust2|24|1|tutorial-series-0.dem",
      fileName: "tutorial-series-0.dem",
    });
    await saveProject(real);
    await saveProject(tutorial);
    await saveProject(series);
    expect(await loadProject(tutorial.key)).toBeNull();
    expect(await loadProject(series.key)).toBeNull();
    expect(await loadProject(real.key)).toBeTruthy();

    const db = await openCs2Db();
    try {
      const tx = db.transaction(PROJECT_STORE, "readwrite");
      await requestOf(tx.objectStore(PROJECT_STORE).put(tutorial));
      await requestOf(tx.objectStore(PROJECT_STORE).put(series));
    } finally {
      db.close();
    }

    const listed = await loadAllProjects();
    expect(listed.map((row) => row.fileName)).toEqual(["b8-vs-spirit-m1-dust2.dem"]);
    expect(await loadProject(tutorial.key)).toBeNull();
    expect(await countProjects()).toBe(1);
  });
});
