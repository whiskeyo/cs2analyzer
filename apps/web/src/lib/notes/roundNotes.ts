import { cloneNote, emptyNote } from "./note";
import type { Note, RoundNote } from "./types";

/** Which in-memory note document the Analyzer board / chrome may show. */
export interface AnalyzerNotesQuery {
  /** Multi-demo Aggregated overlay — never a notes document. */
  aggregated: boolean;
  /** Demo the current `review.notes` array belongs to. */
  notesDemoId?: string | null;
  /** Demo on the radar / round strip now. */
  boardDemoId?: string | null;
}

const HIDDEN_BOARD_NOTE: Note = emptyNote();

export function noteForRound(notes: readonly RoundNote[], round: number): Note {
  return notes.find((row) => row.round === round)?.note ?? emptyNote();
}

/**
 * Live when Aggregated is off and the in-memory notes belong to the board demo.
 * A missing owner is treated as stale so a series hop cannot paint demo A's ink
 * on demo B before restore settles.
 */
export function analyzerNotesLive(query: AnalyzerNotesQuery): boolean {
  if (query.aggregated) return false;
  const boardDemoId = query.boardDemoId ?? null;
  const notesDemoId = query.notesDemoId ?? null;
  if (boardDemoId != null && notesDemoId !== boardDemoId) return false;
  return true;
}

/** Aggregated / mismatched-demo boards have no notes; a live round keeps that round's ink. */
export function noteForAnalyzerBoard(
  notes: readonly RoundNote[],
  round: number,
  query: AnalyzerNotesQuery,
): Note {
  if (!analyzerNotesLive(query)) return HIDDEN_BOARD_NOTE;
  return noteForRound(notes, round);
}

/** Round-strip / scrubber notes: hide the same documents the radar hides. */
export function notesForAnalyzerSession(
  notes: readonly RoundNote[],
  query: AnalyzerNotesQuery,
): RoundNote[] {
  return analyzerNotesLive(query) ? [...notes] : [];
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
