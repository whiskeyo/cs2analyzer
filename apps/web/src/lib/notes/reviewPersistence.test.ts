import { describe, expect, it } from "vitest";
import { loadedDemo } from "@/lib/parse/session";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { COLOR_PRESETS } from "./palettes";
import { matchKey, PROJECT_SCHEMA, type ReviewProject } from "./projectStore";
import { DEFAULT_SUMMARY_FILTER } from "./types";
import { projectFromDemo, reviewSnapshot } from "./reviewPersistence";

function demo(fileName = "match.dem") {
  const replay = makeReplay({
    header: { map_name: "de_mirage", team_ct: "A", team_t: "B" },
    players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
  });
  const file = new File([], fileName, { type: "application/octet-stream" });
  return loadedDemo(replay, fileName, file);
}

const overlay = {
  summaryFilter: DEFAULT_SUMMARY_FILTER,
  floorMode: "auto" as const,
  paletteId: COLOR_PRESETS[0].id,
  color: COLOR_PRESETS[0].colors[0],
};

describe("projectFromDemo", () => {
  it("builds a project keyed by match identity", () => {
    const target = demo();
    const strokes = [
      { type: "arrow" as const, round: 1, color: "#fff", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
    ];
    const row = projectFromDemo(target, 640, strokes, overlay, undefined);
    expect(row.key).toBe(matchKey(target.replay, target.fileName));
    expect(row.schema).toBe(PROJECT_SCHEMA);
    expect(row.strokes).toEqual(strokes);
    expect(row.scorecard).toBeDefined();
    expect(row.playerStats).toBeDefined();
  });

  it("keeps existing stats when withStats is false", () => {
    const target = demo();
    const existing: ReviewProject = {
      schema: PROJECT_SCHEMA,
      key: matchKey(target.replay, target.fileName),
      savedAt: 1,
      fileName: target.fileName,
      mapName: "de_mirage",
      tick: 100,
      strokes: [],
      summaryFilter: DEFAULT_SUMMARY_FILTER,
      floorMode: "auto",
      paletteId: overlay.paletteId,
      color: overlay.color,
      scorecard: {
        teamA: "A",
        teamB: "B",
        scoreA: 13,
        scoreB: 10,
        firstHalf: null,
        secondHalf: null,
        overtime: null,
      },
      playerStats: [
        {
          name: "A",
          start_side: "CT",
          kills: 1,
          deaths: 0,
          adr: 80,
          kast: 100,
          rating: 1.1,
        },
      ],
    };
    const row = projectFromDemo(target, 200, [], overlay, existing, { withStats: false });
    expect(row.scorecard).toEqual(existing.scorecard);
    expect(row.playerStats).toEqual(existing.playerStats);
    expect(row.tick).toBe(200);
  });
});

describe("reviewSnapshot", () => {
  it("captures demo, tick, strokes, and overlay for series cache", () => {
    const target = demo();
    const strokes = [{ type: "pen" as const, round: 1, color: "#000", points: [{ x: 0, y: 0 }] }];
    const snap = reviewSnapshot(target, 128, strokes, overlay);
    expect(snap.demo).toBe(target);
    expect(snap.tick).toBe(128);
    expect(snap.strokes).toEqual(strokes);
    expect(snap.paletteId).toBe(overlay.paletteId);
  });
});
