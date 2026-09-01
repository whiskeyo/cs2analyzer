import { describe, expect, it } from "vitest";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { advanceAtRoundEnd, clampTickToRound, jumpToRound, roundJumpTick } from "./roundAutoplay";

function demo() {
  const ticks = makeTicks(2, 2);
  ticks.ticks[0] = 0;
  ticks.ticks[1] = 5000;
  return makeReplay({
    header: { playback_ticks: 5000 },
    rounds: [
      makeRound({
        number: 1,
        start_tick: 200,
        freeze_end_tick: 264,
        end_tick: 900,
      }),
      makeRound({
        number: 2,
        start_tick: 1000,
        freeze_end_tick: 1064,
        end_tick: 1800,
      }),
      makeRound({
        number: 3,
        start_tick: 1900,
        freeze_end_tick: 1964,
        end_tick: 2600,
      }),
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
    expect(advanceAtRoundEnd(999, replay, false)).toEqual({
      tick: 999,
      playing: false,
    });
  });

  it("jumps to the next round freeze end when autoplay is on", () => {
    const replay = demo();
    expect(advanceAtRoundEnd(999, replay, true)).toEqual({
      tick: 1064,
      playing: true,
      nextRound: replay.rounds[1],
    });
  });

  it("stops on the last round when autoplay is on", () => {
    const replay = demo();
    expect(advanceAtRoundEnd(5000, replay, true)).toEqual({
      tick: 5000,
      playing: false,
    });
  });

  it("does not yank back to the previous round when sitting on the next freeze", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 0;
    ticks.ticks[1] = 5000;
    const replay = makeReplay({
      header: { playback_ticks: 5000 },
      rounds: [
        makeRound({
          number: 18,
          start_tick: 200,
          freeze_end_tick: 264,
          end_tick: 900,
        }),
        makeRound({
          number: 19,
          start_tick: 1000,
          freeze_end_tick: 999,
          end_tick: 1800,
        }),
      ],
      ticks,
    });
    // R18 scrub max is 999. R19 freeze is also 999, which currentRound still calls R18.
    const inferred = advanceAtRoundEnd(999, replay, false);
    if (inferred) {
      expect(inferred.tick).toBeGreaterThanOrEqual(999);
    }
    expect(jumpToRound(replay, replay.rounds[1])).toBe(1000);
    expect(advanceAtRoundEnd(1000, replay, false, replay.rounds[1])).toBeNull();
    expect(
      advanceAtRoundEnd(9064, replay, false, replay.rounds[0])?.tick ?? 9064,
    ).toBeGreaterThanOrEqual(9064);
  });

  it("autoplay off never assigns an earlier tick", () => {
    const replay = demo();
    const atEnd = advanceAtRoundEnd(999, replay, false);
    expect(atEnd).toEqual({ tick: 999, playing: false });
    const overshoot = advanceAtRoundEnd(1200, replay, false, replay.rounds[0]);
    if (overshoot) {
      expect(overshoot.tick).toBeGreaterThanOrEqual(1200);
    }
  });
});

describe("roundJumpTick", () => {
  it("prefers freeze end over round start", () => {
    const round = makeRound({
      number: 1,
      start_tick: 100,
      freeze_end_tick: 164,
    });
    expect(roundJumpTick(round)).toBe(164);
  });

  it("does not land before start_tick when freeze_end is earlier", () => {
    const round = makeRound({
      number: 19,
      start_tick: 1000,
      freeze_end_tick: 900,
    });
    expect(roundJumpTick(round)).toBe(1000);
  });
});

describe("clampTickToRound", () => {
  it("clamps ticks past the round scrub max back into range", () => {
    const replay = demo();
    const round = replay.rounds[0];
    expect(clampTickToRound(replay, 1500, round)).toBe(999);
    expect(clampTickToRound(replay, 500, round)).toBe(500);
  });

  it("lands on freeze end when the destination round is explicit", () => {
    const replay = demo();
    const r18 = replay.rounds[0];
    expect(jumpToRound(replay, r18)).toBe(264);
    expect(clampTickToRound(replay, 264)).toBe(264);
  });

  it("explicit round avoids clamping to the next round scrub max", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 0;
    ticks.ticks[1] = 20_000;
    const replay = makeReplay({
      header: { playback_ticks: 20_000 },
      rounds: [
        makeRound({
          number: 18,
          start_tick: 6000,
          freeze_end_tick: 7064,
          end_tick: 8900,
        }),
        makeRound({
          number: 19,
          start_tick: 7000,
          freeze_end_tick: 9064,
          end_tick: 9900,
        }),
      ],
      ticks,
    });
    const r18 = replay.rounds[0];
    expect(jumpToRound(replay, r18)).toBe(7064);
    expect(clampTickToRound(replay, 7064)).toBe(9064);
  });
});
