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
import { emptyNote } from "./note";
import type { Drawing, Note } from "./types";

const pen: Drawing = {
  type: "pen",
  color: "#fff",
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
};

function loose(partial: Pick<Drawing, "hidden" | "start_tick" | "end_tick"> = {}): Note {
  return { ...emptyNote(), drawings: [{ ...pen, ...partial }] };
}

describe("overlayVisible", () => {
  it("shows a whole-round overlay", () => {
    expect(overlayVisible({ hidden: false }, 100)).toBe(true);
  });

  it("hides a moment overlay outside its window", () => {
    const timed = { ...pen, start_tick: 200, end_tick: 400 };
    expect(overlayVisible(timed, 199)).toBe(false);
    expect(overlayVisible(timed, 200)).toBe(true);
    expect(overlayVisible(timed, 400)).toBe(true);
    expect(overlayVisible(timed, 401)).toBe(false);
  });

  it("hides a note when hidden is set", () => {
    expect(overlayVisible({ ...pen, hidden: true, start_tick: 100, end_tick: 400 }, 200)).toBe(
      false,
    );
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
    expect(withMoment(pen, false, 100, 640, 64)).toEqual(pen);
  });

  it("stamps a window when Moment is on", () => {
    const st = withMoment(pen, true, 100, 640, 64);
    expect(st.start_tick).toBe(100);
    expect(st.end_tick).toBe(100 + 64 * NOTE_MOMENT_SECONDS);
  });
});

describe("setMomentEdge", () => {
  const ref = { kind: "loose" as const, index: 0 };

  it("sets in and out from the playhead", () => {
    const next = setMomentEdge(loose(), ref, "start", 200, 0, 2000, 64);
    expect(next.drawings[0]?.start_tick).toBe(200);
    expect(next.drawings[0]?.end_tick).toBe(200 + 64 * NOTE_MOMENT_SECONDS);
    const both = setMomentEdge(next, ref, "end", 500, 0, 2000, 64);
    expect(both.drawings[0]?.start_tick).toBe(200);
    expect(both.drawings[0]?.end_tick).toBe(500);
  });

  it("keeps the window when out is set at the in tick", () => {
    const next = setMomentEdge(loose(), ref, "start", 200, 0, 2000, 64);
    const both = setMomentEdge(next, ref, "end", 200, 0, 2000, 64);
    expect(both.drawings[0]?.start_tick).toBe(200);
    expect(both.drawings[0]?.end_tick).toBe(next.drawings[0]?.end_tick);
  });
});

describe("setMomentClockEdge", () => {
  it("sets end past one minute on the round clock", () => {
    const origin = 64;
    const next = setMomentClockEdge(
      loose(),
      { kind: "loose", index: 0 },
      "end",
      70,
      origin,
      0,
      50_000,
      64,
    );
    expect(next.drawings[0]?.start_tick).toBe(origin);
    expect(next.drawings[0]?.end_tick).toBe(origin + 70 * 64);
  });
});

describe("setMomentSeconds", () => {
  it("changes duration on a grouped layer", () => {
    const note: Note = {
      ...emptyNote(),
      groups: [
        {
          id: "Group 1",
          name: "Group 1",
          start_tick: 100,
          end_tick: 200,
          drawings: [pen, { ...pen }],
        },
      ],
    };
    const next = setMomentSeconds(
      note,
      { kind: "group", groupIndex: 0, drawingIndex: 1 },
      10,
      64,
      50_000,
      100,
    );
    expect(next.groups[0]?.end_tick).toBe(100 + 64 * 10);
    expect(next.groups[0]?.start_tick).toBe(100);
  });
});
