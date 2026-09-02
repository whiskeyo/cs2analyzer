import { describe, expect, it } from "vitest";
import { ECO_MAX_EQUIPMENT } from "@/lib/shared/constants";
import { makeFreezeTicks, makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { ecoWin } from "./ecoWin";

describe("ecoWin", () => {
  it("records a non-pistol win while under the eco equipment cap", () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = ECO_MAX_EQUIPMENT - 500;
    const m = makeReplay({
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks,
    });
    const { notes, headlines } = playReviewItem(ecoWin, m);
    expect(notes).toEqual([
      {
        tick: 128,
        roundLabel: "R2",
        title: "Won the round on an eco",
        detail: `eq $${ECO_MAX_EQUIPMENT - 500}`,
        severity: "good",
        kind: "eco",
      },
    ]);
    expect(headlines).toEqual([
      { count: 1, severity: "good", kind: "eco", text: "Won 1 eco round" },
    ]);
  });

  it("skips pistol rounds, full buys, and losses", () => {
    const pistolTicks = makeFreezeTicks(2, 1);
    pistolTicks.equip[0] = 800;
    const pistol = makeReplay({
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
      ticks: pistolTicks,
    });
    expect(playReviewItem(ecoWin, pistol).notes).toEqual([]);

    const buy = makeFreezeTicks(2, 1, 128);
    buy.equip[0] = ECO_MAX_EQUIPMENT;
    const full = makeReplay({
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks: buy,
    });
    expect(playReviewItem(ecoWin, full).notes).toEqual([]);

    const lostTicks = makeFreezeTicks(2, 1, 128);
    lostTicks.equip[0] = 800;
    const lost = makeReplay({
      rounds: [
        makeRound({ number: 2, winner: "T", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks: lostTicks,
    });
    const { notes, headlines } = playReviewItem(ecoWin, lost);
    expect(notes).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
