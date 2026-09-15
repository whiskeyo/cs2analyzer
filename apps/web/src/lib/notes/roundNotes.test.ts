import { describe, expect, it } from "vitest";
import { emptyNote } from "./note";
import {
  noteForAnalyzerBoard,
  noteForRound,
  noteRoundNumbers,
  updateRoundNote,
  upsertRoundNote,
} from "./roundNotes";
import type { Drawing } from "./types";

const pen: Drawing = { type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] };

describe("roundNotes", () => {
  it("returns an empty note for a round that has no row", () => {
    expect(noteForRound([], 1)).toEqual(emptyNote());
  });

  it("hides notes on Aggregated and restores them for a live round", () => {
    const notes = [{ round: 1, note: { ...emptyNote(), drawings: [pen] } }];
    expect(noteForAnalyzerBoard(notes, 1, false).drawings).toEqual([pen]);
    expect(noteForAnalyzerBoard(notes, 1, true)).toEqual(emptyNote());
    expect(noteForAnalyzerBoard(notes, 1, false).drawings).toEqual([pen]);
  });

  it("upserts a round and drops empty notes", () => {
    const withPen = upsertRoundNote([], 3, { ...emptyNote(), drawings: [pen] });
    expect(withPen).toEqual([{ round: 3, note: { ...emptyNote(), drawings: [pen] } }]);
    expect(upsertRoundNote(withPen, 3, emptyNote())).toEqual([]);
    expect(noteRoundNumbers(withPen)).toEqual([3]);
  });

  it("updates one round without cloning the others by identity of untouched rows", () => {
    const first = upsertRoundNote([], 1, { ...emptyNote(), drawings: [pen] });
    const both = upsertRoundNote(first, 2, { ...emptyNote(), drawings: [pen] });
    const next = updateRoundNote(both, 2, (note) => ({
      ...note,
      drawings: [...note.drawings, pen],
    }));
    expect(next[0]).toBe(both[0]);
    expect(next[1]?.note.drawings).toHaveLength(2);
  });
});
