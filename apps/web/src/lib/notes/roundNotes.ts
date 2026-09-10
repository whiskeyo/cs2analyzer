import { cloneNote, emptyNote } from "./note";
import type { Note, RoundNote } from "./types";

export function noteForRound(notes: readonly RoundNote[], round: number): Note {
  return notes.find((row) => row.round === round)?.note ?? emptyNote();
}

function noteIsEmpty(note: Note): boolean {
  return (
    note.groups.length === 0 &&
    note.drawings.length === 0 &&
    note.pieces.length === 0 &&
    note.bookmarks.length === 0 &&
    note.radarFx == null
  );
}

export function upsertRoundNote(
  notes: readonly RoundNote[],
  round: number,
  note: Note,
): RoundNote[] {
  const without = notes.filter((row) => row.round !== round);
  if (noteIsEmpty(note)) return without;
  return [...without, { round, note }].sort((a, b) => a.round - b.round);
}

export function updateRoundNote(
  notes: readonly RoundNote[],
  round: number,
  fn: (note: Note) => Note,
): RoundNote[] {
  return upsertRoundNote(notes, round, fn(cloneNote(noteForRound(notes, round))));
}

export function noteRoundNumbers(notes: readonly RoundNote[]): number[] {
  return notes.map((row) => row.round);
}
