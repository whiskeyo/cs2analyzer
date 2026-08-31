import { describe, expect, it } from "vitest";
import { indexesForDrag, parseDrag } from "./drag";
import type { Stroke } from "./types";

describe("indexesForDrag", () => {
  it("drags the whole round selection when the row is selected", () => {
    const strokes: Stroke[] = [
      { type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] },
      { type: "pen", round: 1, color: "#fff", points: [{ x: 1, y: 1 }] },
      { type: "pen", round: 2, color: "#fff", points: [{ x: 2, y: 2 }] },
    ];
    expect(indexesForDrag(0, [0, 1, 2], strokes)).toEqual([0, 1]);
    expect(indexesForDrag(2, [0, 1, 2], strokes)).toEqual([2]);
  });
});

describe("parseDrag", () => {
  it("round-trips a drag payload", () => {
    const payload = { round: 3, indexes: [1, 4] };
    expect(parseDrag(JSON.stringify(payload))).toEqual(payload);
  });

  it("rejects malformed payloads", () => {
    expect(parseDrag("not json")).toBeNull();
    expect(parseDrag(JSON.stringify({ round: "1", indexes: [] }))).toBeNull();
  });
});
