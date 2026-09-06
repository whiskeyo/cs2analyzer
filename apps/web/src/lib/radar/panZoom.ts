import { VIEW_SCALE_MAX, VIEW_SCALE_MIN, VIEW_ZOOM_IN, VIEW_ZOOM_OUT } from "./constants.ts";
import { radarToScreen, screenToRadar, type RadarView } from "./viewport.ts";

export function wheelZoomFactor(deltaY: number): number {
  return deltaY < 0 ? VIEW_ZOOM_IN : VIEW_ZOOM_OUT;
}

export function clampViewScale(scale: number): number {
  return Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, scale));
}

/** Zoom toward the cursor by adjusting pan offset after scale changes. */
export function zoomViewAtCursor(
  view: RadarView,
  w: number,
  h: number,
  mx: number,
  my: number,
  factor: number,
): void {
  const before = screenToRadar(w, h, view, mx, my);
  view.scale = clampViewScale(view.scale * factor);
  const after = radarToScreen(w, h, view, before.x, before.y);
  view.ox += mx - after.x;
  view.oy += my - after.y;
}
