import { describe, expect, it } from "vitest";
import {
  freezeWidth,
  markLabelShift,
  roundScrubEventMarks,
  roundScrubRange,
  roundTimelineMarks,
} from "./roundTimeline";
import type { Round } from "@/lib/replay/replayTypes";
import { makeBombEvent, makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";

/** A full 25s round so the 10s timeline marks have somewhere to land. */
function round(partial: Partial<Round> = {}): Round {
  return makeRound({
    number: 1,
    end_tick: 64 + 64 * 25,
    score_ct: 1,
    ...partial,
  });
}

const fallback = { min: 0, max: 50_000 };

describe("roundScrubRange", () => {
  it("starts at freeze end and extends through demo end on the last round", () => {
    const r = round();
    const end = 64 + 64 * 25;
    expect(roundScrubRange(r, [r], { min: 0, max: end })).toEqual({
      min: 64,
      max: end,
    });
  });

  it("includes post-round through playback_end_tick when present", () => {
    const a = round({
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 2000,
      playback_end_tick: 2050,
    });
    const b = round({
      number: 2,
      start_tick: 2100,
      freeze_end_tick: 2164,
      end_tick: 4000,
    });
    expect(roundScrubRange(a, [a, b], fallback)).toEqual({
      min: 64,
      max: 2050,
    });
  });

  it("extends through post-round cap but not into the next round", () => {
    const a = round({ start_tick: 0, freeze_end_tick: 64, end_tick: 2000 });
    const b = round({
      number: 2,
      start_tick: 2100,
      freeze_end_tick: 2164,
      end_tick: 4000,
    });
    expect(roundScrubRange(a, [a, b], fallback)).toEqual({
      min: 64,
      max: 2099,
    });
  });

  it("matches spirit-vs-big R1: cs_pre_restart, not next freeze", () => {
    const a = round({
      start_tick: 1275,
      freeze_end_tick: 1275,
      end_tick: 6222,
      playback_end_tick: 6522,
    });
    const b = round({
      number: 2,
      start_tick: 7821,
      freeze_end_tick: 7821,
      end_tick: 14551,
    });
    const { max } = roundScrubRange(a, [a, b], { min: 0, max: 200_000 });
    expect(max).toBe(6522);
    expect(max).toBeLessThan(7821);
    expect((max - 1275) / 64).toBeCloseTo(81.98, 0);
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
  it("is zero when freeze is excluded from the scrub range", () => {
    const r = round({ start_tick: 0, freeze_end_tick: 100, end_tick: 1000 });
    expect(freezeWidth(r, { min: 100, max: 1000 })).toBe(0);
  });

  it("is the freeze share when the range still includes freeze", () => {
    const r = round({ start_tick: 0, freeze_end_tick: 100, end_tick: 1000 });
    expect(freezeWidth(r, { min: 0, max: 1000 })).toBeCloseTo(0.1, 5);
  });
});

describe("roundScrubEventMarks", () => {
  it("places kill and bomb icons within the round scrub range", () => {
    const r = round({ start_tick: 0, freeze_end_tick: 64, end_tick: 2000 });
    const replay = makeReplay({
      kills: [makeKill(500, 0, 1, { weapon: "ak47" })],
      bombEvents: [
        makeBombEvent({ tick: 700, kind: "begin_plant" }),
        makeBombEvent({ tick: 800, kind: "planted" }),
        makeBombEvent({ tick: 1200, kind: "defused" }),
        makeBombEvent({ tick: 1800, kind: "exploded" }),
      ],
      players: [
        { index: 0, steam_id: 1, name: "A", start_side: "T", is_bot: false },
        { index: 1, steam_id: 2, name: "B", start_side: "CT", is_bot: false },
      ],
    });
    const range = { min: 64, max: 2100 };
    const marks = roundScrubEventMarks(replay, r, range);
    expect(marks.map((m) => m.kind)).toEqual(["kill", "bomb_plant", "bomb_defuse", "bomb_explode"]);
    expect(marks[0]?.at).toBeCloseTo((500 - 64) / (2100 - 64), 3);
    expect(marks[0]?.victimSide).toBe("CT");
    expect(marks[0]?.color).toBe("#5b9fd6");
  });
});

describe("markLabelShift", () => {
  it("keeps edge labels inside the bar", () => {
    expect(markLabelShift(0)).toBe("0");
    expect(markLabelShift(1)).toBe("-100%");
    expect(markLabelShift(0.5)).toBe("-50%");
  });
});
