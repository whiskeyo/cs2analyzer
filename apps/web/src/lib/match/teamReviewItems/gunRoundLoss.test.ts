import { describe, expect, it } from "vitest";
import { FORCE_BUY_MAX_EQUIPMENT } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { gunRoundLoss } from "./gunRoundLoss";

describe("gunRoundLoss", () => {
  it("flags a lost full vs full", () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({ number: 5, winner: "T", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 1, 0)],
      ticks,
    });
    expect(playTeamReviewItem(gunRoundLoss, m).headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "eco",
        text: "Lost 1 gun round",
        details: [{ tick: 128, roundLabel: "R5", text: "Lost full vs full" }],
      },
    ]);
  });
});
