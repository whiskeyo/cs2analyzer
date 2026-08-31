export type LayoutFloor = "default" | "lower";

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutCallout {
  id: string;
  name: string;
  floor: LayoutFloor;
  /** Members with the same id share one Util filter, like notes layers. */
  group?: string;
  /** Radar pixels on the 1024 Valve overview. */
  polygon: LayoutPoint[];
}

export interface MapLayout {
  schema: 1;
  map: string;
  /** Group names in Action / Util chip order. Omitted → first appearance in `callouts`. */
  groups?: string[];
  callouts: LayoutCallout[];
}
