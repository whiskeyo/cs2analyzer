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

export type Stroke = {
  round: number;
  /** If set with `end_tick`, only visible in that window. Omit both for the whole round. */
  start_tick?: number;
  end_tick?: number;
  /** Members with the same id share one show/hide window. */
  group?: string;
  /** Hidden notes stay in the list but are not drawn. Default is visible. */
  hidden?: boolean;
} & (
  | { type: "pen"; color: string; points: { x: number; y: number }[] }
  | { type: "arrow"; color: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | {
      type: "text";
      color: string;
      x: number;
      y: number;
      text: string;
      box_w?: number;
      box_h?: number;
    }
  | { type: "bookmark"; color: string; text: string }
);

export interface SummaryFilter {
  kinds: Record<GrenadeKind, boolean>;
  t: boolean;
  ct: boolean;
}

export const DEFAULT_SUMMARY_FILTER: SummaryFilter = {
  kinds: { smoke: true, flash: true, he: true, molotov: true, decoy: true },
  t: true,
  ct: true,
};
