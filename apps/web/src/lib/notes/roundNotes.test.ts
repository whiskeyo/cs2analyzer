import { describe, expect, it } from "vitest";
import { emptyNote } from "./note";
import {
  analyzerNotesLive,
  noteForAnalyzerBoard,
  noteForRound,
  noteRoundNumbers,
  notesForAnalyzerSession,
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
    const live = { aggregated: false, notesDemoId: "d1", boardDemoId: "d1" };
    expect(noteForAnalyzerBoard(notes, 1, live).drawings).toEqual([pen]);
    expect(noteForAnalyzerBoard(notes, 1, { ...live, aggregated: true })).toEqual(emptyNote());
    expect(noteForAnalyzerBoard(notes, 1, live).drawings).toEqual([pen]);
  });

  it("hides live notes that still belong to another demo", () => {
    const roundA = { round: 1, note: { ...emptyNote(), drawings: [pen] } };
    const roundB = {
      round: 2,
      note: { ...emptyNote(), drawings: [{ ...pen, color: "#0f0" }] },
    };
    const notesA = [roundA];
    const stale = { aggregated: false, notesDemoId: "d1", boardDemoId: "d2" };
    expect(analyzerNotesLive(stale)).toBe(false);
    expect(noteForAnalyzerBoard(notesA, 1, stale)).toEqual(emptyNote());
    expect(notesForAnalyzerSession(notesA, stale)).toEqual([]);

    const liveB = { aggregated: false, notesDemoId: "d2", boardDemoId: "d2" };
    expect(noteForAnalyzerBoard([roundB], 2, liveB).drawings[0]?.color).toBe("#0f0");
    expect(noteForAnalyzerBoard([roundB], 1, liveB).drawings).toEqual([]);
  });

  it("treats an untagged notes owner as stale when a board demo is selected", () => {
    expect(analyzerNotesLive({ aggregated: false, notesDemoId: null, boardDemoId: "d1" })).toBe(
      false,
    );
    expect(analyzerNotesLive({ aggregated: false })).toBe(true);
    expect(analyzerNotesLive({ aggregated: true, notesDemoId: "d1", boardDemoId: "d1" })).toBe(
      false,
    );
  });

  it("does not treat a single-demo session as Aggregated", () => {
    const notes = [{ round: 1, note: { ...emptyNote(), drawings: [pen] } }];
    expect(
      noteForAnalyzerBoard(notes, 1, {
        aggregated: false,
        notesDemoId: "solo",
        boardDemoId: "solo",
      }).drawings,
    ).toEqual([pen]);
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
