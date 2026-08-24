import { describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "./palettes";
import {
  PROJECT_SCHEMA,
  matchKey,
  parseBundle,
  parseProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";
import { DEFAULT_SUMMARY_FILTER, type Replay } from "./types";

function replay(): Replay {
  return {
    header: {
      map_name: "de_mirage",
      tick_rate: 64,
      tick_stride: 4,
      duration_s: 10,
      playback_ticks: 1920,
      team_ct: "A",
      team_t: "B",
      score_ct: 0,
      score_t: 0,
    },
    players: [
      { index: 0, steam_id: 100, name: "A", start_side: "CT" },
      { index: 1, steam_id: 50, name: "B", start_side: "T" },
    ],
    rounds: [
      {
        number: 1,
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 640,
        winner: "CT",
        win_reason: 8,
        score_ct: 0,
        score_t: 0,
        is_knife: false,
      },
    ],
    grenades: [],
    shots: [],
    kills: [],
    hurts: [],
    blinds: [],
    bombEvents: [],
    stats: [],
    ticks: {
      frameCount: 0,
      playerCount: 0,
      ticks: new Uint32Array(),
      x: new Float32Array(),
      y: new Float32Array(),
      z: new Float32Array(),
      yaw: new Float32Array(),
      health: new Uint8Array(),
      armor: new Uint8Array(),
      flags: new Uint8Array(),
      money: new Uint16Array(),
      equip: new Uint16Array(),
      gear: new Uint16Array(),
      primary: new Uint8Array(),
      secondary: new Uint8Array(),
    },
  };
}

function project(partial: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: PROJECT_SCHEMA,
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

describe("matchKey", () => {
  it("sorts Steam IDs and includes map, rounds, and filename", () => {
    expect(matchKey(replay(), "faceit.dem")).toBe("de_mirage|1|50,100|faceit.dem");
  });
});

describe("parseBundle", () => {
  it("round-trips a bundle and rejects a bad schema", () => {
    const raw = JSON.parse(serializeBundle([project()])) as unknown;
    const bundle = parseBundle(raw);
    expect(bundle?.projects).toHaveLength(1);
    expect(bundle?.projects[0]?.strokes[0]?.type).toBe("arrow");
    expect(parseBundle({ schema: 0, projects: [] })).toBeNull();
  });

  it("accepts a single project object", () => {
    const bundle = parseBundle(project());
    expect(bundle?.projects[0]?.key).toBe("de_mirage|1|50,100|a.dem");
  });

  it("drops malformed strokes", () => {
    const p = parseProject({
      ...project(),
      strokes: [{ type: "pen", round: 1, color: "#fff" }, project().strokes[0]],
    });
    expect(p?.strokes).toHaveLength(1);
  });
});
