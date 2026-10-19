import { describe, expect, it } from "vitest";
import { TRADE_SECONDS, DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { untradedOpenerLoss } from "./untradedOpenerLoss";

describe("untradedOpenerLoss", () => {
  it("flags an untraded first death that loses the round", () => {
    const ticks = makeFreezeTicks(2, 1);
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 1, 0)],
      ticks,
    });
    expect(playTeamReviewItem(untradedOpenerLoss, m).headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "death",
        text: "Lost 1 after untraded opener",
        details: [
          {
            tick: 64,
            roundLabel: "R2",
            text: "Untraded opener — Alice died to Bob",
          },
        ],
      },
    ]);
  });

  it("skips when the opener is traded", () => {
    const ticks = makeFreezeTicks(4, 2);
    const tradeTick = 100 + Math.round(TRADE_SECONDS * DEFAULT_TICK_RATE) - 1;
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "CT", "Support"),
        makePlayer(2, "T", "Bob"),
        makePlayer(3, "T", "Dan"),
      ],
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 2, 0), makeKill(tradeTick, 1, 2), makeKill(400, 3, 1)],
      ticks,
    });
    expect(playTeamReviewItem(untradedOpenerLoss, m).headlines).toEqual([]);
  });
});
