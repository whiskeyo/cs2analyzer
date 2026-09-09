/**
 * DEV layouts-editor types (`layoutEditor`). Schema lives in `lib/layout`;
 * the shipped viewer loads JSON via `lib/radar/layouts.ts`.
 */
import type { LayoutPoint } from "@/lib/layout/types.ts";

export type { LayoutCallout, LayoutFloor, LayoutRegion, MapLayout } from "@/lib/layout/types.ts";
export type Point = LayoutPoint;

export type LayoutDraft =
  | { kind: "polygon"; points: Point[] }
  | { kind: "rect"; start: Point; end: Point }
  | { kind: "circle"; start: Point; end: Point };

export interface MapCalibration {
  pos_x: number;
  pos_y: number;
  scale: number;
  radar: string;
  lower_radar?: string;
}
