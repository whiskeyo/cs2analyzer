export type LayoutFloor = "default" | "lower";

export interface LayoutPoint {
  x: number;
  y: number;
}

/** One connected area of a callout: a polygon or a true circle. */
export type LayoutRegion =
  | { kind: "polygon"; points: LayoutPoint[] }
  | { kind: "circle"; x: number; y: number; radius: number };

export interface LayoutCallout {
  id: string;
  name: string;
  floor: LayoutFloor;
  /** Members with the same id share one Util filter, like notes layers. */
  group?: string;
  /**
   * Radar pixels on the 1024 Valve overview. One callout may cover two
   * disconnected spots (two polygons, or a polygon plus a circle).
   */
  regions: LayoutRegion[];
}

export interface MapLayout {
  schema: 1;
  map: string;
  /** Group names in Action / Util chip order. Omitted → first appearance in `callouts`. */
  groups?: string[];
  callouts: LayoutCallout[];
}
