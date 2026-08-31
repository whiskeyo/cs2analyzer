import { describe, expect, it } from "vitest";
import { NOTE_MOMENT_SECONDS } from "@/lib/shared/constants";
import {
  momentBounds,
  overlayVisible,
  setMomentClockEdge,
  setMomentEdge,
  setMomentSeconds,
  withMoment,
} from "@/lib/notes";
import type { Stroke } from "./types";

function pen(
  partial: Partial<Pick<Stroke, "round" | "start_tick" | "end_tick" | "group">> = {},
): Stroke {
  return {
    type: "pen",
    round: 1,
    color: "#fff",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    ...partial,
  };
}

describe("overlayVisible", () => {
  it("shows a whole-round overlay on that round only", () => {
    const st = pen();
    expect(overlayVisible(st, 100, 1)).toBe(true);
    expect(overlayVisible(st, 100, 2)).toBe(false);
  });

  it("hides a moment overlay outside its window", () => {
    const st = pen({ start_tick: 200, end_tick: 400 });
    expect(overlayVisible(st, 199, 1)).toBe(false);
    expect(overlayVisible(st, 200, 1)).toBe(true);
    expect(overlayVisible(st, 400, 1)).toBe(true);
    expect(overlayVisible(st, 401, 1)).toBe(false);
  });

  it("hides a note when hidden is set", () => {
    const st = pen({ start_tick: 100, end_tick: 400 });
    expect(overlayVisible({ ...st, hidden: true }, 200, 1)).toBe(false);
  });

  it("shows grouped shapes for the union of their windows", () => {
    const a = pen({ start_tick: 100, end_tick: 200, group: "g1" });
    const b = pen({ start_tick: 180, end_tick: 300, group: "g1" });
    const all = [a, b];
    expect(overlayVisible(a, 250, 1, all)).toBe(true);
    expect(overlayVisible(b, 120, 1, all)).toBe(true);
    expect(overlayVisible(a, 301, 1, all)).toBe(false);
  });
});

describe("momentBounds", () => {
  it("spans the named duration at 64 Hz", () => {
    expect(momentBounds(100, 50_000, 64)).toEqual({
      start_tick: 100,
      end_tick: 100 + 64 * NOTE_MOMENT_SECONDS,
    });
  });

  it("clamps to round end", () => {
    expect(momentBounds(600, 640, 64)).toEqual({ start_tick: 600, end_tick: 640 });
  });
});

describe("withMoment", () => {
  it("leaves a round overlay untouched", () => {
    const st = pen();
    expect(withMoment(st, false, 100, 640, 64)).toEqual(st);
  });

  it("stamps a window when Moment is on", () => {
    const st = withMoment(pen(), true, 100, 640, 64);
    expect(st.start_tick).toBe(100);
    expect(st.end_tick).toBe(100 + 64 * NOTE_MOMENT_SECONDS);
  });
});

describe("setMomentEdge", () => {
  it("sets in and out from the playhead", () => {
    const next = setMomentEdge([pen()], 0, "start", 200, 0, 2000, 64);
    expect(next[0].start_tick).toBe(200);
    expect(next[0].end_tick).toBe(200 + 64 * NOTE_MOMENT_SECONDS);
    const both = setMomentEdge(next, 0, "end", 500, 0, 2000, 64);
    expect(both[0].start_tick).toBe(200);
    expect(both[0].end_tick).toBe(500);
  });

  it("keeps the window when out is set at the in tick", () => {
    const next = setMomentEdge([pen()], 0, "start", 200, 0, 2000, 64);
    const both = setMomentEdge(next, 0, "end", 200, 0, 2000, 64);
    expect(both[0].start_tick).toBe(200);
    expect(both[0].end_tick).toBe(next[0].end_tick);
  });
});

describe("setMomentClockEdge", () => {
  it("sets end past one minute on the round clock", () => {
    const origin = 64;
    const next = setMomentClockEdge([pen()], 0, "end", 70, origin, 0, 50_000, 64);
    expect(next[0].start_tick).toBe(origin);
    expect(next[0].end_tick).toBe(origin + 70 * 64);
  });
});

describe("setMomentSeconds", () => {
  it("changes duration for every member of a group", () => {
    const grouped = [
      { ...pen({ start_tick: 100, end_tick: 200 }), group: "Group 1" },
      { ...pen({ start_tick: 100, end_tick: 200 }), group: "Group 1" },
    ];
    const next = setMomentSeconds(grouped, 1, 10, 64, 50_000, 100);
    expect(next[0].end_tick).toBe(100 + 64 * 10);
    expect(next[1].end_tick).toBe(100 + 64 * 10);
  });
});
