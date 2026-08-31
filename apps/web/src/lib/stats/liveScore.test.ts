import { describe, expect, it } from "vitest";
import { currentSide, liveScore, liveTeams } from "./liveScore";
import { FULL_HEALTH } from "@/lib/shared/constants";
import { FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
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
