import { describe, expect, it } from "vitest";
import type { DemoSeries } from "@/lib/parse/session";
import type { SeriesOverlay } from "@/lib/parse/seriesOverlay";
import { DEFAULT_PATH_BRANCH_OPTIONS } from "@/lib/parse/pathBranches";
import { analyzerPawnLegend, uniquePawnLegend } from "./pawnLegend";

function series(demoCount: number): DemoSeries {
  const demos = Array.from({ length: demoCount }, (_, i) => ({
    id: `d${i}`,
    fileName: `m${i}.dem`,
    replay: {} as DemoSeries["demos"][0]["replay"],
    file: {} as DemoSeries["demos"][0]["file"],
  }));
  return {
    mapName: "de_mirage",
    demos,
    focalTeam: "Team A",
    focalTeamNames: ["Team A"],
    tagsByDemo: new Map(),
  };
}

function overlay(trails: SeriesOverlay["trails"]): SeriesOverlay {
  return {
    trails,
    branches: [],
    branchOptions: DEFAULT_PATH_BRANCH_OPTIONS,
    nades: [],
    roundCount: trails.length,
    windowSec: 20,
  };
}

function trail(playerName: string, color: string, steamId = 1): SeriesOverlay["trails"][number] {
  return {
    demoId: "d1",
    roundNumber: 1,
    jumpTick: 64,
    tps: 64,
    steamId,
    playerName,
    color,
    points: [],
    deathAt: null,
    deathTick: null,
    survivedAt: null,
    survivedTick: null,
  };
}

const overlayHabits = {
  aggregated: true,
  overlayOn: true,
  bucketOverlay: { kind: "pistol" as const, side: "CT" as const },
};

const tinted = overlay([
  trail("donk", "#ff2d6a", 1),
  trail("donk", "#ffe600", 1),
  trail("m0NESY", "#00f0ff", 2),
]);

describe("uniquePawnLegend", () => {
  it("keeps the first colour for each non-blank label", () => {
    expect(
      uniquePawnLegend([
        { label: "donk", color: "#ff2d6a" },
        { label: " donk ", color: "#00f0ff" },
        { label: "m0NESY", color: "#00f0ff" },
        { label: "  ", color: "#fff" },
        { label: undefined, color: "#000" },
      ]),
    ).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
  });
});

describe("analyzerPawnLegend", () => {
  it("is empty on a live single-demo round", () => {
    expect(analyzerPawnLegend(series(1), overlayHabits, tinted)).toEqual([]);
    expect(analyzerPawnLegend(null, overlayHabits, tinted)).toEqual([]);
  });

  it("is empty when Aggregated is off in a multi-demo series", () => {
    expect(analyzerPawnLegend(series(2), { ...overlayHabits, aggregated: false }, tinted)).toEqual(
      [],
    );
  });

  it("is empty when Aggregated is on but no overlay bucket is active", () => {
    expect(
      analyzerPawnLegend(series(2), { ...overlayHabits, bucketOverlay: null }, tinted),
    ).toEqual([]);
    expect(analyzerPawnLegend(series(2), { ...overlayHabits, overlayOn: false }, tinted)).toEqual(
      [],
    );
  });

  it("lists unique overlay tints when Aggregated overlay is active", () => {
    expect(analyzerPawnLegend(series(2), overlayHabits, tinted)).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
  });
});
