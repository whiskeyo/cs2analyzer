import { describe, expect, it } from "vitest";
import { inTickWindow, sortedByTick, upToTick } from "./eventIndex";

const tickOf = (e: { tick: number; id: string }) => e.tick;

function events() {
  return [
    { tick: 300, id: "c" },
    { tick: 100, id: "a" },
    { tick: 500, id: "e" },
    { tick: 200, id: "b" },
    { tick: 400, id: "d" },
  ];
}

describe("eventIndex", () => {
  it("sorts by tick and reuses the sorted copy for the same array", () => {
    const raw = events();
    const first = sortedByTick(raw, tickOf);
    expect(first.map((e) => e.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(sortedByTick(raw, tickOf)).toBe(first);
    // The caller's array is left alone.
    expect(raw[0].id).toBe("c");
  });

  it("returns the events inside an inclusive window", () => {
    expect(inTickWindow(events(), tickOf, 200, 400).map((e) => e.id)).toEqual(["b", "c", "d"]);
  });

  it("includes events exactly on either edge", () => {
    expect(inTickWindow(events(), tickOf, 100, 100).map((e) => e.id)).toEqual(["a"]);
    expect(inTickWindow(events(), tickOf, 500, 900).map((e) => e.id)).toEqual(["e"]);
  });

  it("is empty for an inverted or out-of-range window, and for no events", () => {
    expect(inTickWindow(events(), tickOf, 400, 200)).toEqual([]);
    expect(inTickWindow(events(), tickOf, 600, 900)).toEqual([]);
    expect(inTickWindow([], tickOf, 0, 900)).toEqual([]);
    expect(inTickWindow(undefined, tickOf, 0, 900)).toEqual([]);
  });

  it("takes everything at or before a tick", () => {
    expect(upToTick(events(), tickOf, 300).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(upToTick(events(), tickOf, 50)).toEqual([]);
    expect(upToTick(undefined, tickOf, 50)).toEqual([]);
  });
});
