import { describe, expect, it } from "vitest";
import { currentRound, samplePlayer, samplePlayers } from "./sample";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";

describe("samplePlayer", () => {
  it("returns one pawn and null for a missing slot", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 80;
    ticks.x[0] = 10;
    ticks.y[0] = 20;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.active[0] = 23;
    const m = makeReplay({ ticks });
    const a = samplePlayer(m, 0, 80);
    expect(a?.x).toBe(10);
    expect(a?.ct).toBe(true);
    expect(a?.active).toBe(23);
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
