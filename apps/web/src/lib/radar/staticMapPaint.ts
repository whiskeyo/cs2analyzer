import { overlayVisible } from "@/lib/notes";
import { drawArrow, drawTextLabel } from "@/lib/radar/draw";
import { radarLayout, type RadarView } from "@/lib/radar/maps";
import { drawSmoothLine, simplifyStroke } from "@/lib/radar/strokes";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import type { Drawing, Stroke } from "@/lib/notes/types";

export type WorldToScreen = (wx: number, wy: number) => { x: number; y: number };

export interface TextMoveState {
  index: number;
  x: number;
  y: number;
  moved: boolean;
}

export interface NoteStrokePaintOpts {
  tick: number;
  round: number;
  skipTextIndex?: number | null;
  textMove?: TextMoveState | null;
  draft?: Stroke | null;
}

const NO_CAL_LABEL = "No radar for this map — showing world XY";

/** Blit the radar PNG (or a no-calibration placeholder). */
export function paintMapImage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: RadarView,
  img: HTMLImageElement | null | undefined,
  cal: MapCalibration | undefined,
): void {
  const { pad, fit, baseX, baseY } = radarLayout(w, h, view);
  const size = fit * view.scale;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, baseX, baseY, size, size);
    return;
  }
  if (!cal) {
    ctx.fillStyle = "#1a222c";
    ctx.fillRect(baseX, baseY, size, size);
    ctx.fillStyle = "#8b98a5";
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillText(NO_CAL_LABEL, pad, 24);
  }
}

/** One drawing on the map layer (pen, arrow, or text). */
export function paintDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  toScreen: WorldToScreen,
  opts: { alpha?: number; live?: boolean } = {},
): void {
  const { alpha = 1, live = false } = opts;
  if (drawing.type === "text") {
    if (alpha < 1) {
      return;
    }
    drawTextLabel(ctx, drawing, toScreen(drawing.x, drawing.y));
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = drawing.color;
  ctx.fillStyle = drawing.color;
  ctx.lineWidth = drawing.type === "arrow" ? 3.2 : 2.8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (drawing.type === "pen") {
    const worldPts = live ? drawing.points : simplifyStroke(drawing.points);
    const pts = worldPts.map((pt) => toScreen(pt.x, pt.y));
    drawSmoothLine(ctx, pts);
  } else {
    const a = toScreen(drawing.from.x, drawing.from.y);
    const b = toScreen(drawing.to.x, drawing.to.y);
    drawArrow(ctx, a, b, drawing.color, 3.2);
  }
  ctx.globalAlpha = 1;
}

export function paintDrawings(
  ctx: CanvasRenderingContext2D,
  drawings: readonly Drawing[],
  toScreen: WorldToScreen,
  opts: { alpha?: number; live?: boolean } = {},
): void {
  for (const drawing of drawings) {
    paintDrawing(ctx, drawing, toScreen, opts);
  }
}

/** One review stroke on the map layer (pen, arrow, or text). */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  st: Stroke,
  toScreen: WorldToScreen,
  opts: { alpha?: number; live?: boolean } = {},
): void {
  if (st.type === "bookmark") {
    return;
  }
  paintDrawing(ctx, st, toScreen, opts);
}

/** Visible note strokes for the current tick/round, plus any in-progress draft. */
export function paintNoteStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  toScreen: WorldToScreen,
  opts: NoteStrokePaintOpts,
): void {
  const { tick, round, skipTextIndex, textMove, draft } = opts;
  strokes.forEach((st, i) => {
    if (!overlayVisible(st, tick, round, strokes)) {
      return;
    }
    if (st.type === "text" && skipTextIndex === i) {
      return;
    }
    if (st.type === "text" && textMove && textMove.index === i && textMove.moved) {
      paintStroke(ctx, { ...st, x: textMove.x, y: textMove.y }, toScreen);
      return;
    }
    paintStroke(ctx, st, toScreen);
  });
  if (draft && overlayVisible(draft, tick, round, strokes)) {
    paintStroke(ctx, draft, toScreen, { alpha: 0.85, live: true });
  }
}

/** Map PNG plus note strokes — no replay entities. For PDF snapshots and strat planner. */
export function paintStaticMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: RadarView,
  img: HTMLImageElement | null | undefined,
  cal: MapCalibration | undefined,
  strokes: Stroke[],
  strokeOpts: NoteStrokePaintOpts,
  toScreen: WorldToScreen,
): void {
  paintMapImage(ctx, w, h, view, img, cal);
  paintNoteStrokes(ctx, strokes, toScreen, strokeOpts);
}
