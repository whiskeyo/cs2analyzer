import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { makePiece } from "./pieces";
import { notePawnLegend, pawnLegend, shouldShowPawnLegend, visiblePieces } from "./legend";

describe("pawnLegend", () => {
  it("lists unique labeled pawns and hides overlapping names", () => {
    const pieces = [
      makePiece("pawn", 0, 0, { label: "donk", color: "#ff2d6a" }),
      makePiece("pawn", 1, 0, { label: "donk", color: "#ff2d6a" }),
      makePiece("pawn", 2, 0, { label: "m0NESY", color: "#00f0ff" }),
      makePiece("pawn", 3, 0, { side: "CT" }),
    ];
    expect(shouldShowPawnLegend(pieces)).toBe(true);
    expect(pawnLegend(pieces)).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
    expect(shouldShowPawnLegend([makePiece("pawn", 0, 0, { label: "donk" })])).toBe(false);
  });
});

describe("notePawnLegend", () => {
  it("uses the given note and skips a single labeled pawn", () => {
    const note = emptyNote();
    note.pieces.push(
      makePiece("pawn", 0, 0, { label: "donk", color: "#ff2d6a" }),
      makePiece("pawn", 1, 0, { label: "m0NESY", color: "#00f0ff" }),
    );
    expect(notePawnLegend(note)).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
    const one = emptyNote();
    one.pieces.push(makePiece("pawn", 0, 0, { label: "donk" }));
    expect(notePawnLegend(one)).toEqual([]);
  });
});

describe("visiblePieces", () => {
  it("hides tokens that belong to a hidden group", () => {
    const note = emptyNote();
    note.groups.push({ id: "g1", name: "Smoke", hidden: true, drawings: [] });
    note.pieces.push(
      makePiece("smoke", 0, 0, { id: "s", groupId: "g1" }),
      makePiece("pawn", 1, 1, { id: "p" }),
    );
    expect(visiblePieces(note).map((row) => row.id)).toEqual(["p"]);
  });
});
