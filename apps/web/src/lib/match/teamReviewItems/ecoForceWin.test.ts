import { describe, expect, it } from "vitest";
import { ECO_MAX_EQUIPMENT, FORCE_BUY_MAX_EQUIPMENT } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { ecoForceWin } from "./ecoForceWin";

describe("ecoForceWin", () => {
  it("records a non-pistol eco win with a round detail", () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = ECO_MAX_EQUIPMENT - 500;
    ticks.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks,
    });
    const { headlines } = playTeamReviewItem(ecoForceWin, m);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "good",
        kind: "eco",
        text: "Won 1 eco/force round",
        details: [
          {
            tick: 128,
            roundLabel: "R2",
            text: "Won on an eco vs Anti-eco",
          },
        ],
      },
    ]);
  });

  it("records a force win and skips pistol / full / losses", () => {
    const forceTicks = makeFreezeTicks(2, 1, 128);
    forceTicks.equip[0] = FORCE_BUY_MAX_EQUIPMENT - 100;
    forceTicks.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    const force = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 3, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks: forceTicks,
    });
    expect(playTeamReviewItem(ecoForceWin, force).headlines[0]?.details?.[0]?.text).toBe(
      "Won on a force vs Full",
    );

    const pistolTicks = makeFreezeTicks(2, 1);
    pistolTicks.equip[0] = 800;
    pistolTicks.equip[1] = 800;
    const pistol = makeReplay({
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
      ticks: pistolTicks,
    });
    expect(playTeamReviewItem(ecoForceWin, pistol).headlines).toEqual([]);

    const fullTicks = makeFreezeTicks(2, 1, 128);
    fullTicks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    fullTicks.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    const full = makeReplay({
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks: fullTicks,
    });
    expect(playTeamReviewItem(ecoForceWin, full).headlines).toEqual([]);
  });
});
