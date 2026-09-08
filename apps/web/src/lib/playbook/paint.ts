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
import type { NadeTrailDraft } from "./nadeTrail";
import {
  isGrenadePieceKind,
  pawnColor,
  PLAYBOOK_DEAD_PAWN_ALPHA,
  PLAYBOOK_PAWN_SIZE,
  PLAYBOOK_ROTATE_RADIUS_PX,
  rotateHandleOffset,
} from "./pieces";
import { shouldShowPawnLegend, visiblePieces } from "./legend";

/** Match Analyzer nade flight trails. */
export const PLAYBOOK_NADE_TRAIL_OPACITY = 0.4;

/** Bounce dots only for short hand-placed trails, not dense demo samples. */
export const PLAYBOOK_NADE_BOUNCE_DOT_MAX = 6;

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
): void {
  paintMapImage(ctx, w, h, view, img, cal);
  const toScreen = (wx: number, wy: number) => worldToScreen(cal, w, h, view, wx, wy);
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
}
