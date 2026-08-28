export type LayoutFloor = "default" | "lower";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutCallout {
  id: string;
  name: string;
  floor: LayoutFloor;
  /** Members with the same id share one Util filter, like notes layers. */
  group?: string;
  /** Radar pixels on the 1024 Valve overview (same space as the PNG). */
  polygon: Point[];
}

export type LayoutDraft =
  | { kind: "polygon"; points: Point[] }
  | { kind: "rect"; start: Point; end: Point }
  | { kind: "circle"; start: Point; end: Point };

export interface MapLayout {
  schema: 1;
  map: string;
  /** Group names in Action / Util chip order. Omitted → first appearance in `callouts`. */
  groups?: string[];
  callouts: LayoutCallout[];
}

export interface MapCalibration {
  pos_x: number;
  pos_y: number;
  scale: number;
  radar: string;
  lower_radar?: string;
}
