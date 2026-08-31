import { describe, expect, it } from "vitest";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { advanceAtRoundEnd, roundJumpTick } from "./roundAutoplay";

function demo() {
  const ticks = makeTicks(2, 2);
  ticks.ticks[0] = 0;
  ticks.ticks[1] = 5000;
  return makeReplay({
    header: { playback_ticks: 5000 },
    rounds: [
      makeRound({ number: 1, start_tick: 200, freeze_end_tick: 264, end_tick: 900 }),
      makeRound({ number: 2, start_tick: 1000, freeze_end_tick: 1064, end_tick: 1800 }),
      makeRound({ number: 3, start_tick: 1900, freeze_end_tick: 1964, end_tick: 2600 }),
    ],
    ticks,
  });
}

describe("advanceAtRoundEnd", () => {
  it("does nothing before the round scrub max", () => {
    const replay = demo();
    expect(advanceAtRoundEnd(500, replay, true)).toBeNull();
  });

  it("stops at the round scrub max when autoplay is off", () => {
    const replay = demo();
    expect(advanceAtRoundEnd(999, replay, false)).toEqual({ tick: 999, playing: false });
  });

  it("jumps to the next round freeze end when autoplay is on", () => {
    const replay = demo();
    expect(advanceAtRoundEnd(999, replay, true)).toEqual({ tick: 1064, playing: true });
  });

  it("stops on the last round when autoplay is on", () => {
    const replay = demo();
    expect(advanceAtRoundEnd(5000, replay, true)).toEqual({ tick: 5000, playing: false });
  });
});

describe("roundJumpTick", () => {
  it("prefers freeze end over round start", () => {
    const round = makeRound({ number: 1, start_tick: 100, freeze_end_tick: 164 });
    expect(roundJumpTick(round)).toBe(164);
  });
});
