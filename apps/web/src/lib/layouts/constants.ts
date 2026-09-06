export {
  RADAR_FIT_PAD,
  RADAR_OVERVIEW_SIZE,
  VIEW_SCALE_MAX,
  VIEW_SCALE_MIN,
  VIEW_ZOOM_IN,
  VIEW_ZOOM_OUT,
} from "@/lib/radar/constants.ts";

/** Click this close to the first vertex (screen px) to close a polygon. */
export const CLOSE_LOOP_HIT_PX = 10;

/** Grab a vertex within this many screen pixels. */
export const VERTEX_HIT_PX = 8;

/** Double-click an edge within this many screen pixels to split it. */
export const EDGE_HIT_PX = 10;

export const MIN_POLYGON_VERTICES = 3;

/** Skip a dragged rect/circle smaller than this (radar pixels). */
export const MIN_SHAPE_SIZE = 8;

/** Same cap as notes layers (`NOTE_GROUP_NAME_MAX`). */
export const LAYOUT_GROUP_NAME_MAX = 40;

/** Same as `.prettierrc.json` printWidth so Save to folder passes `format:check`. */
export { LAYOUT_JSON_PRINT_WIDTH } from "@/lib/layout/format.ts";

export const CALLOUT_PALETTE = [
  "#ff2d6a",
  "#ffe600",
  "#00f0ff",
  "#3dff6e",
  "#b04cff",
  "#ff7a00",
] as const;
