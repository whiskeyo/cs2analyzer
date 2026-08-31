import type { LayoutPoint } from "@shared/layout/types.ts";

export type { LayoutCallout, LayoutFloor, MapLayout } from "@shared/layout/types.ts";
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
