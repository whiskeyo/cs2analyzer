/**
 * Sample Playbook for the tutorial. Two strats on Mirage: one that looks like an
 * Aggregated overlay snapshot, and one fully drawn by hand. World XY come from
 * the tutorial GOTV ticks (A site / palace), not invented layout points.
 */

import { emptyNote } from "@/lib/notes/note";
import type { Note, NoteRadarFx, Piece } from "@/lib/notes/types";
import { defaultPlaybookColor, defaultPlaybookPaletteId } from "@/lib/playbook/pages";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import { PLAYBOOK_PREFERRED_MAP, PLAYBOOK_SCHEMA, type Playbook } from "@/lib/playbook/types";
import {
  TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID,
  TUTORIAL_PLAYBOOK_HABITS_PAGE_ID,
  TUTORIAL_PLAYBOOK_KEY,
} from "./constants";

export { TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID, TUTORIAL_PLAYBOOK_HABITS_PAGE_ID, TUTORIAL_PLAYBOOK_KEY };

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

/** A-site cluster from the tutorial demo ticks. */
const A_PALACE = { x: 160, y: 2439 };
const A_RAMP = { x: 182, y: 2439 };
const A_SITE = { x: 258, y: 2480 };
const A_TICK = { x: 351, y: 2352 };
const A_DEFAULT = { x: 334, y: 2433 };
const A_CT = { x: 349, y: 2352 };

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
  const donk = pawn("tutorial-habits-donk", "T", A_PALACE, {
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
    x: A_TICK.x,
    y: A_TICK.y,
    nadeStyle: "effect",
    trail: [
      { x: 160, y: 2369 },
      { x: 258, y: 2400 },
      { x: A_TICK.x, y: A_TICK.y },
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
          { x: 120, y: 2360 },
          { x: A_PALACE.x, y: A_PALACE.y },
        ],
        color: T_COLOR,
        groupId: "tutorial-habits-g-donk",
        label: "donk",
      },
      {
        points: [
          { x: 140, y: 2380 },
          { x: A_RAMP.x, y: A_RAMP.y },
        ],
        color: T_COLOR,
        groupId: "tutorial-habits-g-zont1x",
        label: "zont1x",
      },
      {
        points: [
          { x: 400, y: 2500 },
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
          { x: 120, y: 2360 },
          { x: 160, y: 2400 },
          { x: A_PALACE.x, y: A_PALACE.y },
          { x: A_SITE.x, y: A_SITE.y },
        ],
      },
      {
        type: "arrow",
        color: CT_COLOR,
        from: { x: A_CT.x, y: A_CT.y },
        to: { x: A_SITE.x, y: A_SITE.y },
      },
      {
        type: "text",
        color: "#e8eef4",
        x: 220,
        y: 2520,
        text: "A execute",
      },
    ],
    pieces: [
      pawn("tutorial-drawn-t1", "T", A_PALACE, { yaw: 85 }),
      pawn("tutorial-drawn-t2", "T", A_RAMP, { yaw: 95 }),
      pawn("tutorial-drawn-ct1", "CT", A_SITE, { yaw: 260 }),
      pawn("tutorial-drawn-ct2", "CT", A_DEFAULT, { yaw: 240 }),
      {
        id: "tutorial-drawn-smoke",
        kind: "smoke",
        x: A_TICK.x,
        y: A_TICK.y,
        nadeStyle: "icon",
        trail: [
          { x: 180, y: 2360 },
          { x: A_TICK.x, y: A_TICK.y },
        ],
      },
      {
        id: "tutorial-drawn-flash",
        kind: "flash",
        x: 300,
        y: 2410,
        nadeStyle: "icon",
        trail: [
          { x: A_PALACE.x, y: A_PALACE.y },
          { x: 300, y: 2410 },
        ],
      },
    ],
  };
}

export const tutorialPlaybook: Playbook = {
  schema: PLAYBOOK_SCHEMA,
  key: TUTORIAL_PLAYBOOK_KEY,
  mapName: PLAYBOOK_PREFERRED_MAP,
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
