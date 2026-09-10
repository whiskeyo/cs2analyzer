import { describe, expect, it } from "vitest";
import {
  currentSide,
  liveScore,
  liveScoreboardPlayers,
  liveTeams,
  onLiveScoreboard,
} from "./liveScore";
import { FULL_HEALTH } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";

describe("currentSide", () => {
  it("uses the last snapshot, not the previous frame", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks.set([100, 200]);
    ticks.flags.set([FLAG_PRESENT, FLAG_PRESENT | FLAG_CT]);
    ticks.health.fill(FULL_HEALTH);
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks,
    });
    expect(currentSide(m, 0, 100)).toBe("T");
    expect(currentSide(m, 0, 200)).toBe("CT");
  });
});

describe("liveScore", () => {
  it("attributes overtime side-swap wins to the starting teams", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 12, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 200 }),
        makeRound({
          number: 13,
          winner: "CT",
          start_tick: 201,
          freeze_end_tick: 250,
          end_tick: 400,
        }),
      ],
    });
    expect(liveScore(m, 200)).toEqual({ ct: 1, t: 0 });
    expect(liveScore(m, 400)).toEqual({ ct: 1, t: 1 });
  });
});

describe("onLiveScoreboard", () => {
  it("hides a leftover present dead $0 who missed this freeze", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks.set([64, 640]);
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT;
    ticks.flags[2] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[3] = FLAG_PRESENT;
    ticks.health.fill(FULL_HEALTH);
    ticks.health[1] = 0;
    ticks.health[3] = 0;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "KatolikCOO")],
      rounds: [makeRound({ number: 13, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    expect(onLiveScoreboard(m, 0, 640)).toBe(true);
    expect(onLiveScoreboard(m, 1, 640), "ghost $0 leaver must not appear on live scoreboard").toBe(
      false,
    );
  });

  it("drops a sixth $0 leftover when the side already has five", () => {
    const ticks = makeTicks(6, 2);
    ticks.ticks.set([64, 640]);
    for (let i = 0; i < 5; i++) {
      ticks.flags[i] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      ticks.flags[6 + i] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    }
    ticks.flags[5] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[11] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.health.fill(FULL_HEALTH);
    ticks.money[6] = 800;
    ticks.money[7] = 800;
    ticks.money[8] = 800;
    ticks.money[9] = 800;
    ticks.money[10] = 800;
    const m = makeReplay({
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
    expect(onLiveScoreboard(m, 5, 640)).toBe(true);
    expect(
      liveScoreboardPlayers(m, 640),
      "ghost $0 leaver must not appear on live scoreboard",
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps a player who died broke after being alive at freeze", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks.set([64, 640]);
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_CT;
    ticks.health[0] = FULL_HEALTH;
    ticks.health[1] = 0;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      ticks,
    });
    expect(onLiveScoreboard(m, 0, 640)).toBe(true);
  });
});

describe("liveTeams", () => {
  const m = makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, end_tick: 640 })],
  });

  it("names the sides currently playing CT and T", () => {
    expect(liveTeams(m, 640)).toMatchObject({ ctName: "Astralis", tName: "Vitality", ct: 1, t: 0 });
  });

  it("caches per replay and whole tick", () => {
    const teams = liveTeams(m, 640);
    expect(liveTeams(m, 640.5)).toBe(teams);
  });
});
