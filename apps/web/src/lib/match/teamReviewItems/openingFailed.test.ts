import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { openingFailed } from "./openingFailed";

describe("openingFailed", () => {
  it("flags winning the opening then losing the round", () => {
    const ticks = makeFreezeTicks(2, 1);
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 0, 1), makeKill(200, 1, 0)],
      ticks,
    });
    expect(playTeamReviewItem(openingFailed, m).headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "opening",
        text: "Won opening, lost 1 round",
        details: [
          {
            tick: 64,
            roundLabel: "R2",
            text: "Won opening vs Bob, still lost",
          },
        ],
      },
    ]);
  });

  it("skips when the opening win converts", () => {
    const ticks = makeFreezeTicks(2, 1);
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 2, winner: "CT", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 0, 1)],
      ticks,
    });
    expect(playTeamReviewItem(openingFailed, m).headlines).toEqual([]);
  });
});
