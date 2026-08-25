import { describe, expect, it } from "vitest";
import { NOTE_MOMENT_SECONDS } from "./constants";
import {
  earliestTimedTick,
  groupOverlays,
  momentBounds,
  overlayJumpTick,
  overlayVisible,
  withMoment,
} from "./overlay";
import type { Round, Stroke } from "./types";

function pen(partial: Partial<Pick<Stroke, "round" | "start_tick" | "end_tick">> = {}): Stroke {
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

function round(number: number): Round {
  return {
    number,
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 640,
    winner: "CT",
    win_reason: 8,
    score_ct: 0,
    score_t: 0,
    is_knife: false,
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

describe("groupOverlays", () => {
  it("keeps text rows and counts drawings per round", () => {
    const groups = groupOverlays([
      pen({ round: 2 }),
      {
        type: "text",
        round: 1,
        color: "#fff",
        x: 0,
        y: 0,
        text: "hold",
        start_tick: 80,
      },
      pen({ round: 1 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ round: 1, drawings: 1 });
    expect(groups[0].texts).toHaveLength(1);
    expect(groups[1]).toMatchObject({ round: 2, drawings: 1, texts: [] });
  });
});

describe("overlayJumpTick", () => {
  it("jumps to the earliest timed note, else freeze end", () => {
    const r = round(1);
    expect(overlayJumpTick([], r)).toBe(64);
    expect(overlayJumpTick([pen({ start_tick: 200, end_tick: 300 })], r)).toBe(200);
    expect(earliestTimedTick([pen()], 1)).toBeUndefined();
  });
});
