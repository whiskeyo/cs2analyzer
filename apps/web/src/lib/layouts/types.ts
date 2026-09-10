import type { LayoutPoint } from "@/lib/layout/types.ts";
import type { MapCalibration as ReplayMapCalibration } from "@/lib/replay/replayTypes";

export type { LayoutCallout, LayoutFloor, LayoutRegion, MapLayout } from "@/lib/layout/types.ts";
export type Point = LayoutPoint;

export type LayoutDraft =
  | { kind: "polygon"; points: Point[] }
  | { kind: "rect"; start: Point; end: Point }
  | { kind: "circle"; start: Point; end: Point };

export type MapCalibration = Pick<
  ReplayMapCalibration,
  "pos_x" | "pos_y" | "scale" | "radar" | "lower_radar"
>;
