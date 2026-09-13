import { visibleDrawings } from "@/lib/notes/note";
import type { Drawing, FloorMode, Note, NoteRadarFx, Piece } from "@/lib/notes/types";
import {
  drawC4,
  drawHeBurst,
  drawNadeFlightHead,
  nadeEffectZoom,
  yawToCanvas,
  type NadeIcons,
} from "@/lib/radar/draw";
import { radarFloor, worldToScreen, type RadarView } from "@/lib/radar/maps";
import { NADE_COLORS } from "@/lib/radar/radarFx";
import { NADE_LINGER_RADIUS, type RadarFrame } from "@/lib/radar/radarFrame";
import { paintPawns, paintRadarFrame, paintViewCone } from "@/lib/radar/paintRadarFrame";
import {
  paintDrawing,
  paintDrawings,
  paintMapImage,
  type WorldToScreen,
} from "@/lib/radar/staticMapPaint";
import type { GrenadeKind, MapCalibration } from "@/lib/replay/replayTypes";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import type { NadeTrailDraft } from "./nadeTrail";
import {
  isGrenadePieceKind,
  pawnColor,
  PLAYBOOK_DEAD_PAWN_ALPHA,
  PLAYBOOK_PAWN_SIZE,
  PLAYBOOK_ROTATE_RADIUS_PX,
  rotateHandleOffset,
} from "./pieces";
import { notePawnLegend, shouldShowPawnLegend, visiblePieces, type LegendEntry } from "./legend";
import {
  PLAYBOOK_IMAGE_PIN_FRAME,
  PLAYBOOK_IMAGE_PIN_HEIGHT,
  PLAYBOOK_IMAGE_PIN_LAND,
  PLAYBOOK_IMAGE_PIN_SKY,
  PLAYBOOK_IMAGE_PIN_SUN,
  PLAYBOOK_IMAGE_PIN_WIDTH,
} from "./images";
import type { PlaybookImage, PlaybookYouTube } from "./types";
import { YOUTUBE_PIN_HEIGHT, YOUTUBE_PIN_WIDTH, YOUTUBE_PLAY, YOUTUBE_RED } from "./videos";

/** Match Analyzer nade flight trails. */
export const PLAYBOOK_NADE_TRAIL_OPACITY = 0.4;

/** Bounce dots only for short hand-placed trails, not dense demo samples. */
export const PLAYBOOK_NADE_BOUNCE_DOT_MAX = 6;

/** Screen-space inset so the pawn legend sits off the map art. */
export const PLAYBOOK_LEGEND_INSET = 10;
const PLAYBOOK_LEGEND_PAD_X = 10;
const PLAYBOOK_LEGEND_PAD_Y = 8;
const PLAYBOOK_LEGEND_ROW = 18;
const PLAYBOOK_LEGEND_SWATCH = 8;
const PLAYBOOK_LEGEND_GAP = 8;
const PLAYBOOK_LEGEND_FONT = "11px ui-sans-serif, system-ui";
const PLAYBOOK_LEGEND_BG = "#10161ce6";
const PLAYBOOK_LEGEND_BORDER = "#2a3540";
const PLAYBOOK_LEGEND_TEXT = "#e8eef4";

/** Colour → name rows in a corner; used by the board and PDF stills. */
export function paintPawnLegend(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entries: readonly LegendEntry[],
): void {
  if (entries.length === 0) return;
  ctx.save();
  ctx.font = PLAYBOOK_LEGEND_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let textW = 0;
  for (const entry of entries) {
    textW = Math.max(textW, ctx.measureText(entry.label).width);
  }
  const boxW = PLAYBOOK_LEGEND_PAD_X * 2 + PLAYBOOK_LEGEND_SWATCH + PLAYBOOK_LEGEND_GAP + textW;
  const boxH = PLAYBOOK_LEGEND_PAD_Y * 2 + entries.length * PLAYBOOK_LEGEND_ROW;
  const x = Math.max(0, Math.min(PLAYBOOK_LEGEND_INSET, w - boxW));
  const y = Math.max(0, Math.min(PLAYBOOK_LEGEND_INSET, h - boxH));
  ctx.fillStyle = PLAYBOOK_LEGEND_BG;
  ctx.strokeStyle = PLAYBOOK_LEGEND_BORDER;
  ctx.lineWidth = 1;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);
  }
  entries.forEach((entry, i) => {
    const rowY = y + PLAYBOOK_LEGEND_PAD_Y + i * PLAYBOOK_LEGEND_ROW + PLAYBOOK_LEGEND_ROW / 2;
    const swatchX = x + PLAYBOOK_LEGEND_PAD_X + PLAYBOOK_LEGEND_SWATCH / 2;
    ctx.fillStyle = entry.color;
    ctx.beginPath();
    ctx.arc(swatchX, rowY, PLAYBOOK_LEGEND_SWATCH / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PLAYBOOK_LEGEND_TEXT;
    ctx.fillText(entry.label, swatchX + PLAYBOOK_LEGEND_SWATCH / 2 + PLAYBOOK_LEGEND_GAP, rowY);
  });
  ctx.restore();
}

function circle(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, radius: number): void {
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
}

export function paintNadeTrailLine(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  land: { x: number; y: number },
  kind: GrenadeKind,
  toScreen: WorldToScreen,
): void {
  if (points.length === 0) return;
  const color = NADE_COLORS[kind];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = kind === "he" ? 2.2 : 1.8;
  ctx.setLineDash([]);
  ctx.globalAlpha = PLAYBOOK_NADE_TRAIL_OPACITY;
  ctx.beginPath();
  const path = [...points, land];
  path.forEach((pt, i) => {
    const s = toScreen(pt.x, pt.y);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.stroke();
  if (points.length > 1 && points.length <= PLAYBOOK_NADE_BOUNCE_DOT_MAX) {
    ctx.globalAlpha = 0.85;
    for (const pt of points.slice(1)) {
      const s = toScreen(pt.x, pt.y);
      circle(ctx, s, 3);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function paintNadeEffect(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  kind: GrenadeKind,
  scale = 1,
): void {
  const zoom = nadeEffectZoom(scale, null);
  const color = NADE_COLORS[kind];
  if (kind === "he" || kind === "flash") {
    drawHeBurst(ctx, at, color, kind === "flash" ? 0.4 : 0.2, scale, 1, null);
    return;
  }
  const radius = NADE_LINGER_RADIUS[kind] * zoom;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22;
  circle(ctx, at, radius);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.4;
  circle(ctx, at, radius);
  ctx.stroke();
  ctx.restore();
}

export interface PlaybookPaintIcons {
  c4: HTMLImageElement | null;
  nades: NadeIcons;
}

function paintPlaybookPawn(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  at: { x: number; y: number },
  c4Icon: HTMLImageElement | null,
  selected: boolean,
  hideName = false,
): void {
  const color = piece.color ?? pawnColor(piece.side);
  const alive = piece.alive !== false;
  ctx.globalAlpha = alive ? 1 : PLAYBOOK_DEAD_PAWN_ALPHA;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(yawToCanvas(piece.yaw ?? 0));
  ctx.beginPath();
  const size = selected ? PLAYBOOK_PAWN_SIZE + 2 : PLAYBOOK_PAWN_SIZE;
  ctx.moveTo(size + 2, 0);
  ctx.lineTo(-size * 0.7, size * 0.7);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.7, -size * 0.7);
  ctx.closePath();
  ctx.strokeStyle = "#0b0e12";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();

  const name = hideName ? "" : (piece.label?.trim() ?? "");
  if (name) {
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(name, at.x, at.y + 20);
  }
  if (piece.carriesC4) {
    const icon = c4Icon;
    const iconSize = 12;
    if (icon && icon.complete && icon.naturalWidth > 0) {
      ctx.drawImage(icon, at.x + 10, at.y - 6, iconSize, iconSize);
    } else {
      ctx.fillStyle = "#e8d48a";
      ctx.font = "bold 8px ui-sans-serif, system-ui";
      ctx.fillText("C4", at.x + 16, at.y);
    }
  }
  ctx.globalAlpha = 1;
}

export function paintRotateGizmo(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  yaw: number,
  color: string,
): void {
  const radius = PLAYBOOK_ROTATE_RADIUS_PX;
  ctx.save();
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  const handle = rotateHandleOffset(yaw, radius);
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.lineTo(at.x + handle.x, at.y + handle.y);
  ctx.strokeStyle = "#e8eef4";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(at.x + handle.x, at.y + handle.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#0b0e12";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

export function paintPlaybookPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  toScreen: WorldToScreen,
  icons?: PlaybookPaintIcons,
  selected = false,
  scale = 1,
  hidePawnNames = false,
): void {
  const at = toScreen(piece.x, piece.y);
  if (piece.kind === "pawn") {
    paintPlaybookPawn(ctx, piece, at, icons?.c4 ?? null, selected, hidePawnNames);
    return;
  }
  if (piece.kind === "bomb") {
    drawC4(ctx, at, icons?.c4 ?? null);
    return;
  }
  if (!isGrenadePieceKind(piece.kind)) return;
  const kind = piece.kind;
  if (piece.trail && piece.trail.length > 0) {
    paintNadeTrailLine(ctx, piece.trail, { x: piece.x, y: piece.y }, kind, toScreen);
  }
  if (piece.nadeStyle === "effect") {
    paintNadeEffect(ctx, at, kind, scale);
    return;
  }
  drawNadeFlightHead(ctx, at, kind, NADE_COLORS[kind], icons?.nades?.[kind]);
}

export function paintPlaybookPieces(
  ctx: CanvasRenderingContext2D,
  pieces: readonly Piece[],
  toScreen: WorldToScreen,
  icons?: PlaybookPaintIcons,
  selectedId?: string | null,
  scale = 1,
  hidePawnNames = false,
): void {
  for (const piece of pieces) {
    paintPlaybookPiece(ctx, piece, toScreen, icons, piece.id === selectedId, scale, hidePawnNames);
  }
}

export function paintYouTubePin(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  selected = false,
): void {
  const w = YOUTUBE_PIN_WIDTH;
  const h = YOUTUBE_PIN_HEIGHT;
  const x = at.x - w / 2;
  const y = at.y - h / 2;
  const radius = 3;
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fillStyle = YOUTUBE_RED;
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(at.x - 2.2, at.y - 3.2);
  ctx.lineTo(at.x + 3.6, at.y);
  ctx.lineTo(at.x - 2.2, at.y + 3.2);
  ctx.closePath();
  ctx.fillStyle = YOUTUBE_PLAY;
  ctx.fill();
  ctx.restore();
}

export function paintPlaybookImagePin(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  selected = false,
): void {
  const w = PLAYBOOK_IMAGE_PIN_WIDTH;
  const h = PLAYBOOK_IMAGE_PIN_HEIGHT;
  const x = at.x - w / 2;
  const y = at.y - h / 2;
  const radius = 2;
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fillStyle = PLAYBOOK_IMAGE_PIN_FRAME;
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  const inset = 2;
  const photoX = x + inset;
  const photoY = y + inset;
  const photoW = w - inset * 2;
  const photoH = h - inset * 2 - 2;
  ctx.beginPath();
  ctx.rect(photoX, photoY, photoW, photoH);
  ctx.fillStyle = PLAYBOOK_IMAGE_PIN_SKY;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(photoX + photoW * 0.72, photoY + photoH * 0.32, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = PLAYBOOK_IMAGE_PIN_SUN;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(photoX, photoY + photoH);
  ctx.lineTo(photoX + photoW * 0.38, photoY + photoH * 0.42);
  ctx.lineTo(photoX + photoW * 0.62, photoY + photoH * 0.68);
  ctx.lineTo(photoX + photoW, photoY + photoH * 0.5);
  ctx.lineTo(photoX + photoW, photoY + photoH);
  ctx.closePath();
  ctx.fillStyle = PLAYBOOK_IMAGE_PIN_LAND;
  ctx.fill();
  ctx.restore();
}

/**
 * Photo pins sit on the map under ink, tokens, and YouTube pins so a
 * still never hides a nade icon or steals those hits.
 */
export function paintPlaybookImages(
  ctx: CanvasRenderingContext2D,
  images: readonly PlaybookImage[],
  toScreen: WorldToScreen,
  selectedId?: string | null,
): void {
  for (const image of images) {
    paintPlaybookImagePin(ctx, toScreen(image.x, image.y), image.id === selectedId);
  }
}

export function paintYouTubePins(
  ctx: CanvasRenderingContext2D,
  videos: readonly PlaybookYouTube[],
  toScreen: WorldToScreen,
  selectedId?: string | null,
  pending?: { x: number; y: number } | null,
): void {
  for (const clip of videos) {
    paintYouTubePin(ctx, toScreen(clip.x, clip.y), clip.id === selectedId);
  }
  if (pending) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    paintYouTubePin(ctx, toScreen(pending.x, pending.y), true);
    ctx.restore();
  }
}

export function playbookUsesLower(cal: MapCalibration | undefined, floorMode: FloorMode): boolean {
  return radarFloor(cal, [], null, floorMode) === "lower";
}

function radarFxFrame(fx: NoteRadarFx, note: Note): RadarFrame {
  const hidden = new Set(
    note.groups.filter((group) => group.hidden === true).map((group) => group.id),
  );
  return {
    tick: 0,
    round: null,
    players: [],
    useLowerFloor: false,
    heatmap: fx.heatmap,
    summary: fx.summary,
    nades: [],
    tracers: fx.tracers,
    bomb: { state: "none" },
    deaths: fx.deaths,
    opening: fx.opening,
    trails: fx.trails.filter((trail) => !trail.groupId || !hidden.has(trail.groupId)),
    cone: fx.cone,
    hits: fx.hits,
    flashes: fx.flashes,
    pawns: [],
  };
}

export function paintPlaybookBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: RadarView,
  img: HTMLImageElement | null | undefined,
  cal: MapCalibration | undefined,
  note: Note,
  draft?: Drawing | null,
  icons?: PlaybookPaintIcons,
  selectedId?: string | null,
  rotateId?: string | null,
  nadeTrail?: NadeTrailDraft | null,
  videos: readonly PlaybookYouTube[] = [],
  selectedVideoId?: string | null,
  pendingPin?: { x: number; y: number } | null,
  radarGray: number = DEFAULT_RADAR_GRAY,
  images: readonly PlaybookImage[] = [],
  selectedImageId?: string | null,
): void {
  paintMapImage(ctx, w, h, view, img, cal, radarGray);
  const toScreen = (wx: number, wy: number) => worldToScreen(cal, w, h, view, wx, wy);
  paintPlaybookImages(ctx, images, toScreen, selectedImageId);
  paintDrawings(ctx, visibleDrawings(note, null), toScreen);
  if (draft) {
    paintDrawing(ctx, draft, toScreen, { alpha: 0.85, live: true });
  }
  if (note.radarFx) {
    const fxFrame = radarFxFrame(note.radarFx, note);
    paintRadarFrame(ctx, fxFrame, toScreen, {
      scale: view.scale,
      c4Icon: icons?.c4 ?? null,
      nadeIcons: icons?.nades,
    });
  }
  if (nadeTrail) {
    const land = nadeTrail.hover ?? nadeTrail.points[nadeTrail.points.length - 1];
    if (land) {
      paintNadeTrailLine(ctx, nadeTrail.points, land, nadeTrail.kind, toScreen);
    }
  }
  const pieces = visiblePieces(note);
  const hidePawnNames = shouldShowPawnLegend(pieces);
  paintPlaybookPieces(ctx, pieces, toScreen, icons, selectedId, view.scale, hidePawnNames);
  if (note.radarFx) {
    const fxFrame = radarFxFrame(note.radarFx, note);
    paintViewCone(ctx, fxFrame, toScreen);
    paintPawns(ctx, fxFrame, toScreen, false, icons?.c4 ?? null);
  }
  const aimed = rotateId
    ? pieces.find((piece) => piece.id === rotateId && piece.kind === "pawn")
    : undefined;
  if (aimed) {
    paintRotateGizmo(
      ctx,
      toScreen(aimed.x, aimed.y),
      aimed.yaw ?? 0,
      aimed.color ?? pawnColor(aimed.side),
    );
  }
  paintYouTubePins(ctx, videos, toScreen, selectedVideoId, pendingPin);
  paintPawnLegend(ctx, w, h, notePawnLegend(note));
}
