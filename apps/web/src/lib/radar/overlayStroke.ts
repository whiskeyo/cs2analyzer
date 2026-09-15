/**
 * Overlay strokes stay in CSS pixels after `useCanvasLoop` applies DPR.
 *
 * App zoom (`view.scale`) already moves world points through `toScreen`.
 * Multiplying width by zoom fattens trails into jaggy world-space blobs.
 * Browser zoom changes `devicePixelRatio`; the canvas bitmap is resized there.
 * Map PNG and nade/C4 `drawImage` icons can smear; these paths should not.
 */

/** Habits trail polyline. */
export const OVERLAY_HABITS_TRAIL_STROKE = 2.2;
/** Aggregated Overall path-tree stroke (screen px), scaled by fork share. */
export const OVERLAY_PATH_BRANCH_STROKE_MIN = 1.8;
export const OVERLAY_PATH_BRANCH_STROKE_MAX = 5.5;
/** Overall percentage labels stay CSS pixels so zoom does not smear them. */
export const OVERLAY_PATH_BRANCH_LABEL_FONT = 11;
export const OVERLAY_PATH_BRANCH_LABEL_HALO = 3;
/** Live replay trail polyline. */
export const OVERLAY_REPLAY_TRAIL_STROKE = 2;
/** Pawn / habits-arrow chevron (unselected). */
export const OVERLAY_CHEVRON_SIZE = 7;
export const OVERLAY_CHEVRON_OUTLINE = 2;
/** Note pen / arrow ink. */
export const OVERLAY_NOTE_PEN_STROKE = 2.8;
export const OVERLAY_NOTE_ARROW_STROKE = 3.2;
export const OVERLAY_DEATH_STROKE = 1.6;

/** Screen-space stroke. `zoom` is accepted so callers pass `view.scale`; it must not scale the width. */
export function overlayStrokeWidth(baseCssPx: number, zoom = 1): number {
  if (!Number.isFinite(baseCssPx) || baseCssPx <= 0) {
    return 0;
  }
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return baseCssPx;
  }
  return baseCssPx;
}

/** Screen-space marker size (pawns, habits arrows). Same contract as stroke width. */
export function overlayMarkerSize(baseCssPx: number, zoom = 1): number {
  return overlayStrokeWidth(baseCssPx, zoom);
}

/** Path-based chevron. Caller has already translated/rotated to the head. */
export function overlayChevronPath(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  ctx.moveTo(size + 2, 0);
  ctx.lineTo(-size * 0.7, size * 0.7);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.7, -size * 0.7);
  ctx.closePath();
}

/** Round caps so a zoomed polyline does not miter into spikes. */
export function applyOverlayStrokeStyle(ctx: CanvasRenderingContext2D, width: number): void {
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}
