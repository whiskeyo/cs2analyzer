import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { openingRecovered } from "./openingRecovered";

describe("openingRecovered", () => {
  it("flags losing the opening then winning the round", () => {
    const ticks = makeFreezeTicks(2, 1);
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 2, winner: "CT", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 1, 0), makeKill(200, 0, 1)],
      ticks,
    });
    expect(playTeamReviewItem(openingRecovered, m).headlines).toEqual([
      {
        count: 1,
        severity: "good",
        kind: "opening",
        text: "Recovered 1 after losing the opening",
        details: [
          {
            tick: 64,
            roundLabel: "R2",
            text: "Lost opening to Bob, still won",
          },
        ],
      },
    ]);
  });
});
