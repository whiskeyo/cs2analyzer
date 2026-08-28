/** Valve overview texture size. Callout polygons are in this pixel space. */
export const RADAR_OVERVIEW_SIZE = 1024;

/** Fit padding around the radar image (CSS px). */
export const RADAR_FIT_PAD = 16;

export const VIEW_SCALE_MIN = 0.4;
export const VIEW_SCALE_MAX = 6;
export const VIEW_ZOOM_IN = 1.08;
export const VIEW_ZOOM_OUT = 0.92;

/** Click this close to the first vertex (screen px) to close a polygon. */
export const CLOSE_LOOP_HIT_PX = 10;

/** Grab a vertex within this many screen pixels. */
export const VERTEX_HIT_PX = 8;

/** Double-click an edge within this many screen pixels to split it. */
export const EDGE_HIT_PX = 10;

export const MIN_POLYGON_VERTICES = 3;

/** Skip a dragged rect/circle smaller than this (radar pixels). */
export const MIN_SHAPE_SIZE = 8;

/** Vertices used when a drawn circle is stored as a polygon. */
export const CIRCLE_SEGMENTS = 32;

/** Same cap as notes layers (`NOTE_GROUP_NAME_MAX`). */
export const LAYOUT_GROUP_NAME_MAX = 40;

export const CALLOUT_PALETTE = [
  "#ff2d6a",
  "#ffe600",
  "#00f0ff",
  "#3dff6e",
  "#b04cff",
  "#ff7a00",
] as const;
