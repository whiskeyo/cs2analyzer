import { describe, expect, it } from "vitest";
import { makeReplay } from "@/lib/testing/fixtures";
import {
  duplicateSeriesNotice,
  existingSessionDemos,
  formatSeriesNotice,
  loadedSessionCount,
  mergeAppendedDemos,
} from "./appendSeries";
import { buildSeries, loadedDemo } from "./session";

function demo(name: string, mapName: string, extra = name, teamCt = "Spirit", teamT = "G2") {
  const file = new File([extra], name);
  return loadedDemo(
    makeReplay({ header: { map_name: mapName, team_ct: teamCt, team_t: teamT } }),
    name,
    file,
  );
}

describe("existingSessionDemos / loadedSessionCount", () => {
  it("counts a lone loaded demo when series state is empty", () => {
    const only = demo("solo.dem", "de_mirage");
    const snap = { demo: only, series: null, parsedDemos: [], mapGroups: [] };
    expect(existingSessionDemos(snap)).toEqual([only]);
    expect(loadedSessionCount(snap)).toBe(1);
  });

  it("prefers the full parsed list over the active series slice", () => {
    const a = demo("a.dem", "de_mirage");
    const b = demo("b.dem", "de_mirage");
    const c = demo("c.dem", "de_inferno");
    const series = buildSeries("de_mirage", [a, b]);
    expect(
      loadedSessionCount({
        demo: a,
        series,
        parsedDemos: [a, b, c],
        mapGroups: [
          { mapName: "de_mirage", demos: [a, b] },
          { mapName: "de_inferno", demos: [c] },
        ],
      }),
    ).toBe(3);
  });
});

describe("mergeAppendedDemos", () => {
  it("promotes a single demo into a same-map series and keeps the open file", () => {
    const first = demo("first.dem", "de_mirage");
    const second = demo("second.dem", "de_mirage");
    const merged = mergeAppendedDemos({
      existing: [first],
      incoming: [second],
      currentMapName: "de_mirage",
      currentDemoId: first.id,
    });

    expect(merged.added).toEqual([second]);
    expect(merged.duplicates).toEqual([]);
    expect(merged.demo).toBe(first);
    expect(merged.selectedMapName).toBe("de_mirage");
    expect(merged.series.demos).toEqual([first, second]);
    expect(merged.series.tagsByDemo.size).toBe(2);
    expect(merged.groups).toHaveLength(1);
    expect(merged.parsedDemos).toEqual([first, second]);
  });

  it("folds another same-map file into an existing series", () => {
    const a = demo("a.dem", "de_ancient");
    const b = demo("b.dem", "de_ancient");
    const c = demo("c.dem", "de_ancient");
    const merged = mergeAppendedDemos({
      existing: [a, b],
      incoming: [c],
      currentMapName: "de_ancient",
      currentDemoId: b.id,
      focalTeam: "Spirit",
    });

    expect(merged.demo).toBe(b);
    expect(merged.series.demos.map((row) => row.fileName)).toEqual(["a.dem", "b.dem", "c.dem"]);
    expect(merged.series.focalTeam).toBe("Spirit");
    expect(merged.series.tagsByDemo.size).toBe(3);
  });

  it("adds a different map as another group without leaving the current map", () => {
    const mirage = demo("mirage.dem", "de_mirage");
    const ancient = demo("ancient.dem", "de_ancient");
    const merged = mergeAppendedDemos({
      existing: [mirage],
      incoming: [ancient],
      currentMapName: "de_mirage",
      currentDemoId: mirage.id,
    });

    expect(merged.demo).toBe(mirage);
    expect(merged.selectedMapName).toBe("de_mirage");
    expect(merged.series.demos).toEqual([mirage]);
    expect(merged.groups.map((group) => group.mapName).sort()).toEqual(["de_ancient", "de_mirage"]);
  });

  it("skips a file that is already in the session", () => {
    const first = demo("same.dem", "de_mirage", "bytes");
    const clone = loadedDemo(first.replay, first.fileName, first.file);
    const extra = demo("extra.dem", "de_mirage");
    const merged = mergeAppendedDemos({
      existing: [first],
      incoming: [clone, extra],
      currentMapName: "de_mirage",
      currentDemoId: first.id,
    });

    expect(merged.duplicates).toEqual([clone]);
    expect(merged.added).toEqual([extra]);
    expect(merged.series.demos).toEqual([first, extra]);
  });

  it("keeps the current focal team when the incoming file would retie the default", () => {
    const a = demo("a.dem", "de_mirage", "a", "NaVi", "FaZe");
    const b = demo("b.dem", "de_mirage", "b", "FaZe", "NaVi");
    const merged = mergeAppendedDemos({
      existing: [a],
      incoming: [b],
      currentMapName: "de_mirage",
      currentDemoId: a.id,
      focalTeam: "NaVi",
    });
    expect(merged.series.focalTeam).toBe("NaVi");
  });
});

describe("formatSeriesNotice", () => {
  it("matches the multi-file drop sentence for one map", () => {
    const a = demo("a.dem", "de_ancient");
    const b = demo("b.dem", "de_ancient");
    const series = buildSeries("de_ancient", [a, b]);
    expect(formatSeriesNotice([{ mapName: "de_ancient", demos: [a, b] }], series)).toBe(
      "Series: 2 de_ancient demos · Spirit",
    );
  });

  it("names every map group when the session is mixed", () => {
    const mirage = demo("m.dem", "de_mirage");
    const ancient = demo("a.dem", "de_ancient");
    const series = buildSeries("de_mirage", [mirage]);
    expect(
      formatSeriesNotice(
        [
          { mapName: "de_mirage", demos: [mirage] },
          { mapName: "de_ancient", demos: [ancient] },
        ],
        series,
      ),
    ).toBe("Series: 1 de_mirage demo · Spirit · 2 maps (1× de_mirage, 1× de_ancient)");
  });
});

describe("duplicateSeriesNotice", () => {
  it("names the file that is already loaded", () => {
    expect(duplicateSeriesNotice("a.dem")).toBe("a.dem is already in this series.");
  });
});
