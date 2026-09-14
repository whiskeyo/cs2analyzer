import type { Note, Piece } from "@/lib/notes/types";
import { uniquePawnLegend, type LegendEntry } from "@/lib/radar/pawnLegend";
import { pawnColor } from "./pieces";

export type { LegendEntry };

export function pieceGroupHidden(note: Note, piece: Piece): boolean {
  if (!piece.groupId) return false;
  return note.groups.some((group) => group.id === piece.groupId && group.hidden === true);
}

export function visiblePieces(note: Note): Piece[] {
  return note.pieces.filter((piece) => !pieceGroupHidden(note, piece));
}

export function pawnLegend(pieces: readonly Piece[]): LegendEntry[] {
  return uniquePawnLegend(
    pieces
      .filter((piece) => piece.kind === "pawn")
      .map((piece) => ({
        label: piece.label,
        color: piece.color ?? pawnColor(piece.side),
      })),
  );
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

/** Colour → name rows for the current floor note (hidden groups omitted). */
export function notePawnLegend(note: Note): LegendEntry[] {
  const pieces = visiblePieces(note);
  return shouldShowPawnLegend(pieces) ? pawnLegend(pieces) : [];
}
