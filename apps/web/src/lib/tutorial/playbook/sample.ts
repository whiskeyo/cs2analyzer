/**
 * Sample Playbook for the tutorial. Two strats on Dust2 (the Aggregated series
 * map): one that looks like a Habits overlay snapshot, and one fully drawn by
 * hand. World XY sit on A long / ramp / site from the Dust2 radar layout.
 */

import { emptyNote } from "@/lib/notes/note";
import type { Note, NoteRadarFx, Piece } from "@/lib/notes/types";
import { defaultPlaybookColor, defaultPlaybookPaletteId } from "@/lib/playbook/pages";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import { PLAYBOOK_SCHEMA, type Playbook } from "@/lib/playbook/types";
import {
  TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID,
  TUTORIAL_PLAYBOOK_HABITS_PAGE_ID,
  TUTORIAL_PLAYBOOK_KEY,
  TUTORIAL_PLAYBOOK_MAP,
} from "./constants";

export {
  TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID,
  TUTORIAL_PLAYBOOK_HABITS_PAGE_ID,
  TUTORIAL_PLAYBOOK_KEY,
  TUTORIAL_PLAYBOOK_MAP,
};

function emptyRadarFx(trails: NoteRadarFx["trails"] = []): NoteRadarFx {
  return {
    deaths: [],
    opening: null,
    tracers: [],
    trails,
    heatmap: [],
    summary: [],
    cone: null,
    hits: [],
    flashes: [],
  };
}

/** Dust2 A-site cluster (world XY from `de_dust2` radar layout + calibration). */
const A_LONG = { x: 1264, y: 1260 };
const A_RAMP = { x: 1440, y: 2557 };
const A_SITE = { x: 1110, y: 2544 };
const A_CROSS = { x: 1075, y: 2148 };
const A_GOOSE = { x: 1299, y: 3019 };

function pawn(
  id: string,
  side: "CT" | "T",
  at: { x: number; y: number },
  extra: Pick<Piece, "label" | "yaw" | "groupId" | "color"> = {},
): Piece {
  return {
    id,
    kind: "pawn",
    x: at.x,
    y: at.y,
    side,
    yaw: extra.yaw ?? (side === "T" ? 90 : 270),
    alive: true,
    ...extra,
  };
}

function habitsSnapshotNote(): Note {
  const donk = pawn("tutorial-habits-donk", "T", A_LONG, {
    label: "donk",
    groupId: "tutorial-habits-g-donk",
    color: T_COLOR,
    yaw: 80,
  });
  const zont1x = pawn("tutorial-habits-zont1x", "T", A_RAMP, {
    label: "zont1x",
    groupId: "tutorial-habits-g-zont1x",
    color: T_COLOR,
    yaw: 70,
  });
  const apEX = pawn("tutorial-habits-apex", "CT", A_SITE, {
    label: "apEX",
    groupId: "tutorial-habits-g-apex",
    color: CT_COLOR,
    yaw: 250,
  });
  const smoke: Piece = {
    id: "tutorial-habits-smoke",
    kind: "smoke",
    x: A_SITE.x,
    y: A_SITE.y,
    nadeStyle: "effect",
    trail: [
      { x: A_LONG.x, y: A_LONG.y },
      { x: A_CROSS.x, y: A_CROSS.y },
      { x: A_SITE.x, y: A_SITE.y },
    ],
  };
  return {
    ...emptyNote(),
    groups: [
      { id: "tutorial-habits-g-donk", name: "donk", drawings: [] },
      { id: "tutorial-habits-g-zont1x", name: "zont1x", drawings: [] },
      { id: "tutorial-habits-g-apex", name: "apEX", drawings: [] },
    ],
    pieces: [donk, zont1x, apEX, smoke],
    radarFx: emptyRadarFx([
      {
        points: [
          { x: A_LONG.x, y: A_LONG.y + 80 },
          { x: A_LONG.x, y: A_LONG.y },
        ],
        color: T_COLOR,
        groupId: "tutorial-habits-g-donk",
        label: "donk",
      },
      {
        points: [
          { x: A_RAMP.x - 80, y: A_RAMP.y - 120 },
          { x: A_RAMP.x, y: A_RAMP.y },
        ],
        color: T_COLOR,
        groupId: "tutorial-habits-g-zont1x",
        label: "zont1x",
      },
      {
        points: [
          { x: A_GOOSE.x, y: A_GOOSE.y },
          { x: A_SITE.x, y: A_SITE.y },
        ],
        color: CT_COLOR,
        groupId: "tutorial-habits-g-apex",
        label: "apEX",
      },
    ]),
  };
}

function drawnExecuteNote(): Note {
  return {
    ...emptyNote(),
    drawings: [
      {
        type: "pen",
        color: T_COLOR,
        points: [
          { x: A_LONG.x, y: A_LONG.y },
          { x: A_CROSS.x, y: A_CROSS.y },
          { x: A_RAMP.x, y: A_RAMP.y },
          { x: A_SITE.x, y: A_SITE.y },
        ],
      },
      {
        type: "arrow",
        color: CT_COLOR,
        from: { x: A_GOOSE.x, y: A_GOOSE.y },
        to: { x: A_SITE.x, y: A_SITE.y },
      },
      {
        type: "text",
        color: "#e8eef4",
        x: A_CROSS.x,
        y: A_CROSS.y,
        text: "A execute",
      },
    ],
    pieces: [
      pawn("tutorial-drawn-t1", "T", A_LONG, { yaw: 85 }),
      pawn("tutorial-drawn-t2", "T", A_RAMP, { yaw: 95 }),
      pawn("tutorial-drawn-ct1", "CT", A_SITE, { yaw: 260 }),
      pawn("tutorial-drawn-ct2", "CT", A_GOOSE, { yaw: 240 }),
      {
        id: "tutorial-drawn-smoke",
        kind: "smoke",
        x: A_SITE.x,
        y: A_SITE.y,
        nadeStyle: "icon",
        trail: [
          { x: A_LONG.x, y: A_LONG.y },
          { x: A_SITE.x, y: A_SITE.y },
        ],
      },
      {
        id: "tutorial-drawn-flash",
        kind: "flash",
        x: A_CROSS.x,
        y: A_CROSS.y,
        nadeStyle: "icon",
        trail: [
          { x: A_LONG.x, y: A_LONG.y },
          { x: A_CROSS.x, y: A_CROSS.y },
        ],
      },
    ],
  };
}

export const tutorialPlaybook: Playbook = {
  schema: PLAYBOOK_SCHEMA,
  key: TUTORIAL_PLAYBOOK_KEY,
  mapName: TUTORIAL_PLAYBOOK_MAP,
  title: "Tutorial",
  savedAt: 0,
  sort: 0,
  pages: [
    {
      id: TUTORIAL_PLAYBOOK_HABITS_PAGE_ID,
      title: "Habits snapshot",
      body: "Example of an Aggregated overlay snapshot. Pawn trails show where the team walked in that round window.",
      floor: "auto",
      note: habitsSnapshotNote(),
      videos: [],
      images: [],
      lowerNote: emptyNote(),
      lowerVideos: [],
      lowerImages: [],
    },
    {
      id: TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID,
      title: "A execute (drawn)",
      body: "Hand-authored strat: CT/T pawns, a smoke, a flash trail, and drawn notes. Add images or a YouTube clip from the toolbar.",
      floor: "auto",
      note: drawnExecuteNote(),
      videos: [],
      images: [],
      lowerNote: emptyNote(),
      lowerVideos: [],
      lowerImages: [],
    },
  ],
  activePageId: TUTORIAL_PLAYBOOK_HABITS_PAGE_ID,
  paletteId: defaultPlaybookPaletteId(),
  color: defaultPlaybookColor(),
};
