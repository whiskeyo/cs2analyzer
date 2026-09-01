/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "./palettes";
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
    strokes: [
      { type: "arrow", round: 1, color: "#ff1744", from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
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
    expect(loaded?.strokes[0]?.type).toBe("arrow");
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
});
