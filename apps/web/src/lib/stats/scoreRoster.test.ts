import { describe, expect, it } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { FULL_HEALTH } from "@/lib/shared/constants";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { scoreRoster } from "./scoreRoster";

describe("scoreRoster", () => {
  it("keeps a mid-match leaver on their last side and money", () => {
    const ticks = makeTicks(2, 3);
    ticks.ticks.set([64, 800, 1700]);
    const alive = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[0] = alive | FLAG_CT;
    ticks.flags[1] = alive;
    ticks.flags[2] = alive | FLAG_CT;
    ticks.flags[3] = alive;
    ticks.flags[4] = 0;
    ticks.flags[5] = alive | FLAG_CT;
    ticks.health.fill(FULL_HEALTH);
    ticks.money[0] = 4700;
    ticks.money[2] = 1200;
    ticks.money[5] = 3000;
    const replay = makeReplay({
      players: [makePlayer(0, "T", "Harbor"), makePlayer(1, "CT", "Bob")],
      rounds: [
        makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 700 }),
        makeRound({ number: 2, start_tick: 1000, freeze_end_tick: 1064, end_tick: 1800 }),
      ],
      ticks,
    });

    const roster = scoreRoster(replay, 1700);
    const harbor = roster.find((slot) => slot.player === 0);
    expect(harbor).toEqual({ player: 0, side: "CT", money: 1200 });
    expect(roster.find((slot) => slot.player === 1)?.side).toBe("CT");
  });

  it("does not invent a row for someone who never stood on a side", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 64;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = 0;
    ticks.health[0] = FULL_HEALTH;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Ghost")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    expect(scoreRoster(replay, 640).map((slot) => slot.player)).toEqual([0]);
  });

  it("leaves bots off even when they are connected", () => {
    const ticks = makeTicks(1, 1);
    ticks.ticks[0] = 64;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.health[0] = FULL_HEALTH;
    const replay = makeReplay({
      players: [makePlayer(0, "T", "Operator", 7, true)],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    expect(scoreRoster(replay, 64)).toEqual([]);
  });

  it("still hides a sixth connected leftover", () => {
    const ticks = makeTicks(6, 2);
    ticks.ticks.set([64, 640]);
    for (let i = 0; i < 6; i++) {
      ticks.flags[i] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      ticks.flags[6 + i] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      ticks.health[i] = FULL_HEALTH;
      ticks.health[6 + i] = FULL_HEALTH;
    }
    for (let i = 0; i < 5; i++) ticks.money[6 + i] = 800;
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "CT", "B"),
        makePlayer(2, "CT", "C"),
        makePlayer(3, "CT", "D"),
        makePlayer(4, "CT", "E"),
        makePlayer(5, "CT", "KatolikCOO"),
      ],
      rounds: [makeRound({ number: 13, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    expect(scoreRoster(replay, 640).map((slot) => slot.player)).toEqual([0, 1, 2, 3, 4]);
  });
});
