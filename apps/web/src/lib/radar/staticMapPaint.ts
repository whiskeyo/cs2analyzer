import { overlayVisible, refsEqual } from "@/lib/notes";
import type { NoteItemRef } from "@/lib/notes/noteGroups";
import { drawArrow, drawTextLabel } from "@/lib/radar/draw";
import { withRadarMapGray } from "@/lib/radar/mapGray";
import { paintMapOutline, withRadarMapPaper } from "@/lib/radar/mapPaper";
import { radarLayout, type RadarView } from "@/lib/radar/maps";
import { drawSmoothLine, simplifyStroke } from "@/lib/radar/strokes";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import type { Drawing, Note } from "@/lib/notes/types";
import {
  OVERLAY_NOTE_ARROW_STROKE,
  OVERLAY_NOTE_PEN_STROKE,
  overlayStrokeWidth,
} from "@/lib/radar/overlayStroke";
import { DEFAULT_RADAR_GRAY, DEFAULT_RADAR_PAPER } from "@/lib/shared/constants";

export type WorldToScreen = (wx: number, wy: number) => { x: number; y: number };

export interface TextMoveState {
  ref: NoteItemRef;
  x: number;
  y: number;
  moved: boolean;
}

export interface NotePaintOpts {
  tick: number;
  skipText?: NoteItemRef | null;
  textMove?: TextMoveState | null;
  draft?: Drawing | null;
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
  radarGray: number = DEFAULT_RADAR_GRAY,
  radarPaper: boolean = DEFAULT_RADAR_PAPER,
): void {
  const { pad, fit, baseX, baseY } = radarLayout(w, h, view);
  const size = fit * view.scale;
  if (img && img.complete && img.naturalWidth > 0) {
    const blit = () => {
      ctx.drawImage(img, baseX, baseY, size, size);
    };
    if (radarPaper) {
      withRadarMapPaper(ctx, blit);
      paintMapOutline(ctx, img, baseX, baseY, size);
    } else {
      withRadarMapGray(ctx, radarGray, blit);
    }
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
  ctx.lineWidth = overlayStrokeWidth(
    drawing.type === "arrow" ? OVERLAY_NOTE_ARROW_STROKE : OVERLAY_NOTE_PEN_STROKE,
  );
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

function paintVisibleDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  ref: NoteItemRef,
  toScreen: WorldToScreen,
  opts: NotePaintOpts,
): void {
  if (drawing.type === "text" && opts.skipText && refsEqual(opts.skipText, ref)) return;
  if (
    drawing.type === "text" &&
    opts.textMove &&
    refsEqual(opts.textMove.ref, ref) &&
    opts.textMove.moved
  ) {
    paintDrawing(ctx, { ...drawing, x: opts.textMove.x, y: opts.textMove.y }, toScreen);
    return;
  }
  paintDrawing(ctx, drawing, toScreen);
}

/** Visible note drawings for the current tick, plus any in-progress draft. */
export function paintNote(
  ctx: CanvasRenderingContext2D,
  note: Note,
  toScreen: WorldToScreen,
  opts: NotePaintOpts,
): void {
  const { tick, draft } = opts;
  for (let g = 0; g < note.groups.length; g++) {
    const group = note.groups[g];
    if (!group || group.hidden || !overlayVisible(group, tick)) continue;
    for (let d = 0; d < group.drawings.length; d++) {
      const drawing = group.drawings[d];
      if (!drawing || drawing.hidden) continue;
      paintVisibleDrawing(
        ctx,
        drawing,
        { kind: "group", groupIndex: g, drawingIndex: d },
        toScreen,
        opts,
      );
    }
  }
  for (let i = 0; i < note.drawings.length; i++) {
    const drawing = note.drawings[i];
    if (!drawing || !overlayVisible(drawing, tick)) continue;
    paintVisibleDrawing(ctx, drawing, { kind: "loose", index: i }, toScreen, opts);
  }
  if (draft && overlayVisible(draft, tick)) {
    paintDrawing(ctx, draft, toScreen, { alpha: 0.85, live: true });
  }
}

/** Map PNG plus note drawings — no replay entities. For PDF snapshots and strat planner. */
export function paintStaticMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: RadarView,
  img: HTMLImageElement | null | undefined,
  cal: MapCalibration | undefined,
  note: Note,
  paintOpts: NotePaintOpts,
  toScreen: WorldToScreen,
  radarGray: number = DEFAULT_RADAR_GRAY,
  radarPaper: boolean = DEFAULT_RADAR_PAPER,
): void {
  paintMapImage(ctx, w, h, view, img, cal, radarGray, radarPaper);
  paintNote(ctx, note, toScreen, paintOpts);
}
