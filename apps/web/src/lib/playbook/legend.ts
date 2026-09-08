import type { Note, Piece } from "@/lib/notes/types";
import { pawnColor } from "./pieces";

export interface LegendEntry {
  label: string;
  color: string;
}

export function pieceGroupHidden(note: Note, piece: Piece): boolean {
  if (!piece.groupId) return false;
  return note.groups.some((group) => group.id === piece.groupId && group.hidden === true);
}

export function visiblePieces(note: Note): Piece[] {
  return note.pieces.filter((piece) => !pieceGroupHidden(note, piece));
}

export function pawnLegend(pieces: readonly Piece[]): LegendEntry[] {
  const seen = new Map<string, string>();
  for (const piece of pieces) {
    if (piece.kind !== "pawn") continue;
    const label = piece.label?.trim();
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.set(label, piece.color ?? pawnColor(piece.side));
  }
  return [...seen.entries()].map(([label, color]) => ({ label, color }));
}

/** Overlapping names on an aggregated snapshot (two or more labeled pawns). */
export function shouldShowPawnLegend(pieces: readonly Piece[]): boolean {
  let labeled = 0;
  for (const piece of pieces) {
    if (piece.kind !== "pawn") continue;
    if (piece.label?.trim()) labeled += 1;
    if (labeled >= 2) return true;
  }
  return false;
}
