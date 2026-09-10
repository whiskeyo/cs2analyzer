import { RADAR_FIT_PAD, RADAR_OVERVIEW_SIZE } from "./constants.ts";

export interface RadarView {
  scale: number;
  ox: number;
  oy: number;
}

export interface RadarPoint {
  x: number;
  y: number;
}

export function radarLayout(w: number, h: number, view: RadarView) {
  const pad = RADAR_FIT_PAD;
  const fit = Math.min(w, h) - pad * 2;
  const baseX = (w - fit) / 2 + view.ox;
  const baseY = (h - fit) / 2 + view.oy;
  return { pad, fit, baseX, baseY, imgSize: RADAR_OVERVIEW_SIZE };
}

export function screenToRadar(
  w: number,
  h: number,
  view: RadarView,
  sx: number,
  sy: number,
): RadarPoint {
  const { fit, baseX, baseY, imgSize } = radarLayout(w, h, view);
  const span = fit * view.scale || 1;
  return {
    x: ((sx - baseX) / span) * imgSize,
    y: ((sy - baseY) / span) * imgSize,
  };
}

export function radarToScreen(
  w: number,
  h: number,
  view: RadarView,
  rx: number,
  ry: number,
): RadarPoint {
  const { fit, baseX, baseY, imgSize } = radarLayout(w, h, view);
  return {
    x: baseX + (rx / imgSize) * fit * view.scale,
    y: baseY + (ry / imgSize) * fit * view.scale,
  };
}

/** Pan so a radar-pixel point sits at the canvas centre. Follow-cam uses this. */
export function centerViewOnRadarPoint(
  view: RadarView,
  w: number,
  h: number,
  rx: number,
  ry: number,
): void {
  const unpanned = { scale: view.scale, ox: 0, oy: 0 };
  const screen = radarToScreen(w, h, unpanned, rx, ry);
  view.ox = w / 2 - screen.x;
  view.oy = h / 2 - screen.y;
}
