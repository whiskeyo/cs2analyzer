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
import { antiEcoLoss } from "./antiEcoLoss";

describe("antiEcoLoss", () => {
  it("flags a lost anti-eco with a clickable round detail", () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[1] = ECO_MAX_EQUIPMENT - 1;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 4, winner: "T", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 1, 0)],
      ticks,
    });
    const { headlines } = playTeamReviewItem(antiEcoLoss, m);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "eco",
        text: "Lost 1 anti-eco round",
        details: [{ tick: 128, roundLabel: "R4", text: "Lost an anti-eco vs Eco" }],
      },
    ]);
  });

  it("skips wins and non-anti-eco buys", () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[1] = ECO_MAX_EQUIPMENT - 1;
    const won = makeReplay({
      rounds: [
        makeRound({ number: 4, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks,
    });
    expect(playTeamReviewItem(antiEcoLoss, won).headlines).toEqual([]);

    const full = makeFreezeTicks(2, 1, 128);
    full.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    full.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    const gun = makeReplay({
      rounds: [
        makeRound({ number: 5, winner: "T", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 1, 0)],
      ticks: full,
    });
    expect(playTeamReviewItem(antiEcoLoss, gun).headlines).toEqual([]);
  });
});
