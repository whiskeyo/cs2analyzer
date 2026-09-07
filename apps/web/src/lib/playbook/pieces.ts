import { cloneNote } from "@/lib/notes/note";
import type { Note, Piece, PieceKind } from "@/lib/notes/types";
import { canvasToYaw } from "@/lib/radar/draw";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import type { GrenadeKind } from "@/lib/replay/replayTypes";

/** Canvas hit radius for a playbook token (pointer size, not world units). */
export const PIECE_HIT_PX = 14;

/** Unselected radar pawn triangle size. */
export const PLAYBOOK_PAWN_SIZE = 7;

/** Dead pawn alpha — same as live radar. */
export const PLAYBOOK_DEAD_PAWN_ALPHA = 0.35;

export const GRENADE_PIECE_KINDS = [
  "smoke",
  "flash",
  "he",
  "molotov",
  "incendiary",
  "decoy",
] as const satisfies readonly GrenadeKind[];

export type PlaybookDrawTool = "pen" | "arrow" | "text" | "eraser";
export type PlaybookTool = "pan" | PlaybookDrawTool | "pawn-ct" | "pawn-t" | GrenadeKind | "bomb";

export const DRAW_TOOLS: readonly { tool: PlaybookDrawTool; label: string }[] = [
  { tool: "pen", label: "Pen" },
  { tool: "arrow", label: "Arrow" },
  { tool: "text", label: "Text" },
  { tool: "eraser", label: "Eraser" },
];

export function isDrawTool(tool: PlaybookTool): tool is PlaybookDrawTool {
  return tool === "pen" || tool === "arrow" || tool === "text" || tool === "eraser";
}

export function isTokenTool(
  tool: PlaybookTool,
): tool is Exclude<PlaybookTool, "pan" | PlaybookDrawTool> {
  return tool !== "pan" && !isDrawTool(tool);
}

export type PaletteToken = {
  tool: Exclude<PlaybookTool, "pan">;
  label: string;
};

export const PALETTE_TOKENS: readonly PaletteToken[] = [
  { tool: "pawn-ct", label: "CT" },
  { tool: "pawn-t", label: "T" },
  { tool: "smoke", label: "Smoke" },
  { tool: "flash", label: "Flash" },
  { tool: "he", label: "HE" },
  { tool: "molotov", label: "Molly" },
  { tool: "incendiary", label: "Incendiary" },
  { tool: "decoy", label: "Decoy" },
  { tool: "bomb", label: "Bomb" },
];

export function isGrenadePieceKind(kind: PieceKind): kind is GrenadeKind {
  return (GRENADE_PIECE_KINDS as readonly string[]).includes(kind);
}

export function pieceKindLabel(kind: PieceKind): string {
  switch (kind) {
    case "pawn":
      return "Pawn";
    case "he":
      return "HE";
    case "molotov":
      return "Molly";
    case "incendiary":
      return "Incendiary";
    case "bomb":
      return "Bomb";
    case "smoke":
      return "Smoke";
    case "flash":
      return "Flash";
    case "decoy":
      return "Decoy";
  }
}

export function pieceLabel(piece: Piece): string {
  const named = piece.label?.trim();
  if (named) return named;
  if (piece.kind === "pawn") return piece.side ?? "Pawn";
  return pieceKindLabel(piece.kind);
}

export function pawnColor(side: Piece["side"]): string {
  return side === "T" ? T_COLOR : CT_COLOR;
}

export function makePiece(
  kind: PieceKind,
  x: number,
  y: number,
  extra: Omit<Partial<Piece>, "kind" | "x" | "y"> = {},
): Piece {
  const { id, ...rest } = extra;
  const piece: Piece = { id: id ?? crypto.randomUUID(), kind, x, y, ...rest };
  if (kind === "pawn") {
    piece.side = rest.side ?? "CT";
    piece.yaw = rest.yaw ?? 0;
    piece.alive = rest.alive ?? true;
  }
  return piece;
}

export function pieceFromTool(tool: PlaybookTool, x: number, y: number): Piece | null {
  if (!isTokenTool(tool)) return null;
  if (tool === "pawn-ct") return makePiece("pawn", x, y, { side: "CT" });
  if (tool === "pawn-t") return makePiece("pawn", x, y, { side: "T" });
  if (tool === "bomb") return makePiece("bomb", x, y);
  return makePiece(tool, x, y);
}

export function addPiece(note: Note, piece: Piece): Note {
  const next = cloneNote(note);
  next.pieces.push(piece);
  return next;
}

export function movePiece(note: Note, id: string, x: number, y: number): Note {
  const next = cloneNote(note);
  const piece = next.pieces.find((row) => row.id === id);
  if (!piece) return note;
  piece.x = x;
  piece.y = y;
  return next;
}

export function setPieceYaw(note: Note, id: string, yaw: number): Note {
  const next = cloneNote(note);
  const piece = next.pieces.find((row) => row.id === id);
  if (!piece || piece.kind !== "pawn") return note;
  piece.yaw = yaw;
  return next;
}

export function setPieceLabel(note: Note, id: string, label: string): Note {
  const next = cloneNote(note);
  const piece = next.pieces.find((row) => row.id === id);
  if (!piece) return note;
  const trimmed = label.trim();
  if (trimmed === "") {
    delete piece.label;
  } else {
    piece.label = trimmed;
  }
  return next;
}

export function removePiece(note: Note, id: string): Note {
  const next = cloneNote(note);
  const pieces = next.pieces.filter((row) => row.id !== id);
  if (pieces.length === next.pieces.length) return note;
  next.pieces = pieces;
  return next;
}

export function hitTestPiece(
  pieces: readonly Piece[],
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  hitPx = PIECE_HIT_PX,
): Piece | null {
  const radiusSq = hitPx * hitPx;
  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i]!;
    const at = toScreen(piece.x, piece.y);
    const dx = at.x - screen.x;
    const dy = at.y - screen.y;
    if (dx * dx + dy * dy <= radiusSq) return piece;
  }
  return null;
}

/** Eye yaw so the pawn triangle points from `from` toward `to` in screen space. */
export function yawTowardScreen(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  return canvasToYaw(Math.atan2(to.y - from.y, to.x - from.x));
}

export type PlaybookDownAction = "place" | "pan" | "move" | "rotate" | "draw" | "text" | "erase";

export function resolvePlaybookDown(
  tool: PlaybookTool,
  hit: Piece | null,
  shiftKey: boolean,
): PlaybookDownAction {
  if (tool === "eraser") return "erase";
  if (tool === "text") return "text";
  if (tool === "pen" || tool === "arrow") return "draw";
  if (isTokenTool(tool)) return "place";
  if (hit && shiftKey && hit.kind === "pawn") return "rotate";
  if (hit) return "move";
  return "pan";
}

export function playbookToolCursor(tool: PlaybookTool): string {
  if (tool === "pan") return "grab";
  if (tool === "eraser") return "cell";
  if (tool === "pen" || tool === "arrow" || tool === "text") return "crosshair";
  return "copy";
}

export function paletteAriaLabel(token: PaletteToken): string {
  if (token.tool === "pawn-ct") return "CT pawn";
  if (token.tool === "pawn-t") return "T pawn";
  return token.label;
}
