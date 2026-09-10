import type { GrenadeKind } from "@/lib/replay/replayTypes";

export type DrawTool = "pan" | "pen" | "arrow" | "text" | "bookmark" | "eraser";

/** Canvas cursor per draw tool — keep exhaustive when adding a tool. */
export const RADAR_TOOL_CURSOR = {
  pan: "grab",
  pen: "crosshair",
  arrow: "crosshair",
  text: "crosshair",
  bookmark: "pointer",
  eraser: "cell",
} satisfies Record<DrawTool, string>;

export type FloorMode = "auto" | "upper" | "lower";

export interface MapLayers {
  grenades: boolean;
  shots: boolean;
  names: boolean;
  deaths: boolean;
  cone: boolean;
  heatmap: boolean;
  summary: boolean;
  openings: boolean;
}

export const DEFAULT_LAYERS: MapLayers = {
  grenades: true,
  shots: true,
  names: true,
  deaths: true,
  cone: true,
  heatmap: false,
  summary: false,
  openings: true,
};

/** Geometry for one pen, arrow, or text label. */
export type DrawingShape =
  | { type: "pen"; color: string; points: { x: number; y: number }[] }
  | {
      type: "arrow";
      color: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  | {
      type: "text";
      color: string;
      x: number;
      y: number;
      text: string;
      box_w?: number;
      box_h?: number;
    };

export type PenStroke = Extract<DrawingShape, { type: "pen" }>;
export type Arrow = Extract<DrawingShape, { type: "arrow" }>;
export type TextLabel = Extract<DrawingShape, { type: "text" }>;

/**
 * One drawing: geometry plus display metadata.
 * Analyzer stamps a tick window; a playbook strat omits ticks.
 */
export type Drawing = DrawingShape & {
  hidden?: boolean;
  start_tick?: number;
  end_tick?: number;
};

export interface DrawingGroup {
  id: string;
  name: string;
  hidden?: boolean;
  start_tick?: number;
  end_tick?: number;
  drawings: Drawing[];
}

export interface Bookmark {
  color: string;
  text: string;
  /** Pin tick. Analyzer only. */
  tick: number;
  start_tick?: number;
  end_tick?: number;
  hidden?: boolean;
}

export type PieceKind =
  "pawn" | "smoke" | "flash" | "he" | "molotov" | "incendiary" | "decoy" | "bomb";

/** How a playbook grenade is painted: weapon SVG or the Analyzer linger/burst. */
export type NadeStyle = "icon" | "effect";

export interface Piece {
  id: string;
  kind: PieceKind;
  x: number;
  y: number;
  z?: number;
  /** Pawn facing — same raw yaw as replay (`m_angEyeAngles`). */
  yaw?: number;
  side?: "CT" | "T";
  /** Radar fill. Omit = CT/T side colour. */
  color?: string;
  label?: string;
  alive?: boolean;
  carriesC4?: boolean;
  /** Drawing group this token belongs to. Hidden groups hide the token. */
  groupId?: string;
  /** Throw + bounce points. Land is `x` / `y`. Playbook nade trails. */
  trail?: { x: number; y: number }[];
  /** Grenade paint. Omit = icon. */
  nadeStyle?: NadeStyle;
}

export interface NotePoint {
  x: number;
  y: number;
}

export interface NoteKillLine {
  from: NotePoint;
  to: NotePoint;
  color: string;
  alpha: number;
  lineWidth: number;
}

/** Demo radar marks copied onto a playbook strat (kill lines, FK/FD, shots). */
export interface NoteRadarFx {
  deaths: { x: number; y: number; line: NoteKillLine | null }[];
  opening: { from: NotePoint; to: NotePoint; color: string } | null;
  tracers: { x: number; y: number; yaw: number; fade: number }[];
  trails: { points: NotePoint[]; color: string; groupId?: string; label?: string }[];
  heatmap: { x: number; y: number; radius: number; color: string }[];
  summary: { x: number; y: number; radius: number; color: string }[];
  cone: { x: number; y: number; yaw: number; radius: number; color: string } | null;
  hits: {
    x: number;
    y: number;
    innerRadius: number;
    ringRadius: number;
    innerAlpha: number;
    ringAlpha: number;
  }[];
  flashes: {
    x: number;
    y: number;
    intensity: number;
    pulseRadius: number;
    left: number;
  }[];
}

/** Shared overlay owned by a demo round or a playbook strat. */
export interface Note {
  groups: DrawingGroup[];
  drawings: Drawing[];
  pieces: Piece[];
  bookmarks: Bookmark[];
  radarFx?: NoteRadarFx;
}

export interface RoundNote {
  round: number;
  note: Note;
}

/**
 * Flat Analyzer canvas stroke. Disk/export is `Note` only (schema 4).
 * Review history is `RoundNote[]`; canvas/sidebar still flatten at the edge
 * until they cut over to `Note`.
 */
export type Stroke = {
  round: number;
  /** If set with `end_tick`, only visible in that window. Omit both for the whole round. */
  start_tick?: number;
  end_tick?: number;
  /** Members with the same id share one show/hide window. */
  group?: string;
  /** Hidden notes stay in the list but are not drawn. Default is visible. */
  hidden?: boolean;
} & (Drawing | { type: "bookmark"; color: string; text: string });

export interface SummaryFilter {
  kinds: Record<GrenadeKind, boolean>;
  t: boolean;
  ct: boolean;
}

export const DEFAULT_SUMMARY_FILTER: SummaryFilter = {
  kinds: {
    smoke: true,
    flash: true,
    he: true,
    molotov: true,
    incendiary: true,
    decoy: true,
  },
  t: true,
  ct: true,
};
