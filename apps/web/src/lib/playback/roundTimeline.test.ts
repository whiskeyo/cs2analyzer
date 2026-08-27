import { describe, expect, it } from "vitest";
import { freezeWidth, markLabelShift, roundScrubRange, roundTimelineMarks } from "./roundTimeline";
import type { Round } from "@/lib/replay/replayTypes";
import { makeRound } from "@/lib/testing/fixtures";

/** A full 25s round so the 10s timeline marks have somewhere to land. */
function round(partial: Partial<Round> = {}): Round {
  return makeRound({ number: 1, end_tick: 64 + 64 * 25, score_ct: 1, ...partial });
}

const fallback = { min: 0, max: 50_000 };

describe("roundScrubRange", () => {
  it("uses the current round, not the whole demo", () => {
    const r = round();
    expect(roundScrubRange(r, [r], fallback)).toEqual({
      min: 0,
      max: 50_000,
    });
  });

  it("stops before the next round starts", () => {
    const a = round({ start_tick: 0, freeze_end_tick: 64, end_tick: 2000 });
    const b = round({ number: 2, start_tick: 2100, freeze_end_tick: 2164, end_tick: 4000 });
    expect(roundScrubRange(a, [a, b], fallback)).toEqual({ min: 0, max: 2099 });
  });
});

describe("roundTimelineMarks", () => {
  it("places 0:00 at freeze end and then every 10 seconds", () => {
    const r = round();
    const range = roundScrubRange(r, [r], { min: 0, max: 64 + 64 * 25 });
    const marks = roundTimelineMarks(r, 64, range);
    expect(marks[0]).toMatchObject({ tick: 64, label: "0:00" });
    expect(marks[1]).toMatchObject({ tick: 64 + 64 * 10, label: "0:10" });
    expect(marks.some((m) => m.label === "0:20")).toBe(true);
    expect(marks.at(-1)?.tick).toBeLessThanOrEqual(range.max);
  });
});

describe("freezeWidth", () => {
  it("is the freeze share of the round bar", () => {
    const r = round({ start_tick: 0, freeze_end_tick: 100, end_tick: 1000 });
    expect(freezeWidth(r, { min: 0, max: 1000 })).toBeCloseTo(0.1, 5);
  });
});

describe("markLabelShift", () => {
  it("keeps edge labels inside the bar", () => {
    expect(markLabelShift(0)).toBe("0");
    expect(markLabelShift(1)).toBe("-100%");
    expect(markLabelShift(0.5)).toBe("-50%");
  });
});
