import { visibleDrawings } from "@/lib/notes/note";
import type { Drawing, FloorMode, Note, Piece } from "@/lib/notes/types";
import { drawC4, drawNadeFlightHead, yawToCanvas, type NadeIcons } from "@/lib/radar/draw";
import { radarFloor, worldToScreen, type RadarView } from "@/lib/radar/maps";
import { NADE_COLORS } from "@/lib/radar/radarFx";
import {
  paintDrawing,
  paintDrawings,
  paintMapImage,
  type WorldToScreen,
} from "@/lib/radar/staticMapPaint";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { pawnColor, pieceLabel, PLAYBOOK_DEAD_PAWN_ALPHA, PLAYBOOK_PAWN_SIZE } from "./pieces";

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
): void {
  const color = pawnColor(piece.side);
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

  const name = pieceLabel(piece);
  ctx.font = "10px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8eef4";
  ctx.fillText(name, at.x, at.y + 20);
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

export function paintPlaybookPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  toScreen: WorldToScreen,
  icons?: PlaybookPaintIcons,
  selected = false,
): void {
  const at = toScreen(piece.x, piece.y);
  if (piece.kind === "pawn") {
    paintPlaybookPawn(ctx, piece, at, icons?.c4 ?? null, selected);
    return;
  }
  if (piece.kind === "bomb") {
    drawC4(ctx, at, icons?.c4 ?? null);
    return;
  }
  drawNadeFlightHead(ctx, at, piece.kind, NADE_COLORS[piece.kind], icons?.nades?.[piece.kind]);
}

export function paintPlaybookPieces(
  ctx: CanvasRenderingContext2D,
  pieces: readonly Piece[],
  toScreen: WorldToScreen,
  icons?: PlaybookPaintIcons,
  selectedId?: string | null,
): void {
  for (const piece of pieces) {
    paintPlaybookPiece(ctx, piece, toScreen, icons, piece.id === selectedId);
  }
}

export function playbookUsesLower(cal: MapCalibration | undefined, floorMode: FloorMode): boolean {
  return radarFloor(cal, [], null, floorMode) === "lower";
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
): void {
  paintMapImage(ctx, w, h, view, img, cal);
  const toScreen = (wx: number, wy: number) => worldToScreen(cal, w, h, view, wx, wy);
  paintDrawings(ctx, visibleDrawings(note, null), toScreen);
  if (draft) {
    paintDrawing(ctx, draft, toScreen, { alpha: 0.85, live: true });
  }
  paintPlaybookPieces(ctx, note.pieces, toScreen, icons, selectedId);
}
