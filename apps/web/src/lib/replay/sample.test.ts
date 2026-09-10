import { describe, expect, it } from "vitest";
import { currentRound, samplePlayer, samplePlayers, trailingFlagStart } from "./sample";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_DEFUSING,
  FLAG_PLANTING,
  FLAG_PRESENT,
  type Replay,
} from "@/lib/replay/replayTypes";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";

describe("samplePlayer", () => {
  it("returns one pawn and null for a missing slot", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 80;
    ticks.x[0] = 10;
    ticks.y[0] = 20;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT | FLAG_DEFUSING;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_PLANTING;
    ticks.active[0] = 23;
    const m = makeReplay({ ticks });
    const a = samplePlayer(m, 0, 80);
    expect(a?.x).toBe(10);
    expect(a?.ct).toBe(true);
    expect(a?.defusing).toBe(true);
    expect(a?.planting).toBe(false);
    expect(samplePlayer(m, 1, 80)?.planting).toBe(true);
    expect(a?.active).toBe(23);
    expect(a?.clip).toBe(0);
    expect(samplePlayer(m, 2, 80)).toBeNull();
    expect(samplePlayers(m, 80)).toHaveLength(2);
  });

  it("reuses the snapshot for a tick it already sampled", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 80;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({ ticks });
    expect(samplePlayers(m, 80)).toBe(samplePlayers(m, 80));
    expect(samplePlayers(m, 90)).not.toBe(samplePlayers(m, 80));
  });
});

describe("currentRound", () => {
  const rounds = [
    makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
    makeRound({ number: 1, start_tick: 200, end_tick: 900 }),
    makeRound({ number: 2, start_tick: 1000, end_tick: 1800 }),
    makeRound({ number: 3, start_tick: 2000, end_tick: 2800 }),
  ];
  const replay = makeReplay({ rounds });

  it("takes the last round that has started", () => {
    expect(currentRound(replay, 0)?.number).toBe(0);
    expect(currentRound(replay, 200)?.number).toBe(1);
    expect(currentRound(replay, 500)?.number).toBe(1);
    expect(currentRound(replay, 2500)?.number).toBe(3);
    expect(currentRound(replay, 99999)?.number).toBe(3);
  });

  it("keeps the gap after a round inside that round", () => {
    // Round 1 ended at 900 but round 2 has not started, so 950 is still R1.
    expect(currentRound(replay, 950)?.number).toBe(1);
  });

  it("falls back to the first round before the demo starts, and null with no rounds", () => {
    expect(currentRound(replay, -50)?.number).toBe(0);
    expect(currentRound(makeReplay({ rounds: [] }), 100)).toBeNull();
  });
});

/** Old linear scan — F4 must match this, including fromTick clamp and sparse frames. */
function naiveTrailingFlagStart(
  replay: Replay,
  player: number,
  flag: number,
  fromTick: number,
  toTick: number,
): number | null {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player < 0 || player >= pc || buf.frameCount === 0) return null;
  let start: number | null = null;
  let on = false;
  for (let f = 0; f < buf.frameCount; f++) {
    const t = buf.ticks[f];
    if (t > toTick) break;
    const flags = buf.flags[f * pc + player];
    if ((flags & flag) !== 0) {
      if (!on) start = Math.max(t, fromTick);
      on = true;
    } else {
      start = null;
      on = false;
    }
  }
  return on ? start : null;
}

function flagReplay(frameTicks: number[], onAtFrame: boolean[], flag = FLAG_DEFUSING): Replay {
  const ticks = makeTicks(1, frameTicks.length);
  for (let f = 0; f < frameTicks.length; f++) {
    ticks.ticks[f] = frameTicks[f];
    ticks.flags[f] = FLAG_PRESENT | FLAG_ALIVE | (onAtFrame[f] ? flag : 0);
  }
  return makeReplay({ ticks });
}

describe("trailingFlagStart", () => {
  it("returns null when the flag is off at toTick, before the first frame, or for a bad slot", () => {
    const replay = flagReplay([64, 200], [false, true]);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 63)).toBeNull();
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 199)).toBeNull();
    expect(trailingFlagStart(replay, 1, FLAG_DEFUSING, 0, 200)).toBeNull();
    expect(
      trailingFlagStart(makeReplay({ ticks: makeTicks() }), 0, FLAG_DEFUSING, 0, 200),
    ).toBeNull();
  });

  it("returns the first tick of the run that still covers toTick", () => {
    const replay = flagReplay([64, 128, 192, 256], [false, true, true, false]);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 128)).toBe(128);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 192)).toBe(128);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 200)).toBe(128);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 256)).toBeNull();
  });

  it("clamps the start to fromTick when the run was already on", () => {
    const replay = flagReplay([64, 200], [true, true]);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 100, 200)).toBe(100);
  });

  it("uses the latest run after a gap, not an earlier plant/defuse attempt", () => {
    const replay = flagReplay([100, 200, 300, 400], [true, false, true, true], FLAG_PLANTING);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 200)).toBeNull();
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 400)).toBe(300);
  });

  it("skips a long off prefix (binary search) and keeps the same start while the run lasts", () => {
    const n = 512;
    const frameTicks = Array.from({ length: n }, (_, f) => f * 4);
    const onAtFrame = frameTicks.map((t) => t >= 1800 && t <= 2000);
    const replay = flagReplay(frameTicks, onAtFrame, FLAG_PLANTING);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 1796)).toBeNull();
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 1800)).toBe(1800);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 1900)).toBe(1800);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 2000)).toBe(1800);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 2004)).toBeNull();
  });

  it("does not reuse a cached start across a gap into a later run", () => {
    const replay = flagReplay(
      [100, 200, 300, 400, 500, 600],
      [true, true, false, false, true, true],
      FLAG_PLANTING,
    );
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 200)).toBe(100);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 600)).toBe(500);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 200)).toBe(100);
  });

  it("matches the linear scan on sparse frames and mixed runs", () => {
    const frameTicks = Array.from({ length: 80 }, (_, f) => 40 + f * 8);
    const onAtFrame = frameTicks.map((t) => (t >= 120 && t < 200) || (t >= 400 && t <= 480));
    const replay = flagReplay(frameTicks, onAtFrame);
    for (const fromTick of [0, 100, 150, 400]) {
      for (let toTick = 20; toTick <= 520; toTick += 7) {
        expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, fromTick, toTick)).toBe(
          naiveTrailingFlagStart(replay, 0, FLAG_DEFUSING, fromTick, toTick),
        );
      }
    }
  });
});
