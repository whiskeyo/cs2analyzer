import { describe, expect, it } from "vitest";
import { parseJson } from "@shared/validate/json.ts";
import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { COLOR_PRESETS } from "./palettes";
import {
  PROJECT_SCHEMA,
  matchKey,
  parseBundle,
  parseProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";
import type { Replay } from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { DEFAULT_SUMMARY_FILTER } from "./types";

/** `matchKey` reads the map, round count, and sorted Steam IDs. */
function replay(): Replay {
  return makeReplay({
    header: { map_name: "de_mirage", team_ct: "A", team_t: "B" },
    players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
  });
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
    const raw = parseJson(serializeBundle([project()]));
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

  it("keeps old files without ticks and loads text plus a moment window", () => {
    const p = parseProject({
      ...project(),
      strokes: [
        project().strokes[0],
        {
          type: "text",
          round: 1,
          color: "#ff1744",
          x: 10,
          y: 20,
          text: "hold mid",
          start_tick: 120,
          end_tick: 440,
        },
        { type: "text", round: 1, color: "#fff", x: 0, y: 0 },
      ],
    });
    expect(p?.strokes).toHaveLength(2);
    expect(p?.strokes[0]).toEqual(project().strokes[0]);
    expect(p?.strokes[1]).toMatchObject({
      type: "text",
      text: "hold mid",
      start_tick: 120,
      end_tick: 440,
    });
  });

  it("keeps a resized text box", () => {
    const p = parseProject({
      ...project(),
      strokes: [
        {
          type: "text",
          round: 1,
          color: "#ff1744",
          x: 10,
          y: 20,
          text: "hold mid",
          box_w: 240,
          box_h: 80,
        },
      ],
    });
    expect(p?.strokes[0]).toMatchObject({
      type: "text",
      text: "hold mid",
      box_w: 240,
      box_h: 80,
    });
  });

  it("keeps a group id on a stroke", () => {
    const p = parseProject({
      ...project(),
      strokes: [
        { ...project().strokes[0], group: "g2", start_tick: 10, end_tick: 80, hidden: true },
      ],
    });
    expect(p?.strokes[0]).toMatchObject({
      group: "g2",
      start_tick: 10,
      end_tick: 80,
      hidden: true,
    });
  });

  it("loads schema 1 notes and optional score snapshots", () => {
    const p = parseProject({
      ...project(),
      schema: 1,
      scorecard: {
        teamA: "EYEBALLERS",
        teamB: "Phantom",
        scoreA: 17,
        scoreB: 19,
        firstHalf: { a: 6, b: 6 },
        secondHalf: { a: 6, b: 6 },
        overtime: { a: 5, b: 7 },
      },
      playerStats: [
        {
          name: "s1mple",
          start_side: "CT",
          kills: 24,
          deaths: 18,
          adr: 88,
          kast: 72,
          rating: 1.23,
        },
      ],
    });
    expect(p?.schema).toBe(PROJECT_SCHEMA);
    expect(p?.scorecard?.scoreA).toBe(17);
    expect(p?.playerStats?.[0]?.name).toBe("s1mple");
  });

  it("keeps schema 1 notes that have no score snapshot", () => {
    const p = parseProject({ ...project(), schema: 1 });
    expect(p?.key).toBe("de_mirage|1|50,100|a.dem");
    expect(p?.scorecard).toBeUndefined();
    expect(p?.playerStats).toBeUndefined();
  });

  it("keeps a bookmark and fills a blank title", () => {
    const p = parseProject({
      ...project(),
      strokes: [
        {
          type: "bookmark",
          round: 1,
          color: "#ff1744",
          text: "",
          start_tick: 80,
          end_tick: 80,
        },
      ],
    });
    expect(p?.strokes[0]).toMatchObject({
      type: "bookmark",
      text: NOTE_BOOKMARK_TITLE,
      start_tick: 80,
      end_tick: 80,
    });
  });
});
