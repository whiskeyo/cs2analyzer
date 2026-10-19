import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { manAdvantageLoss } from "./manAdvantageLoss";

describe("manAdvantageLoss", () => {
  it("flags a loss after holding a 3v2 with size in the detail", () => {
    const players = [
      makePlayer(0, "CT", "A"),
      makePlayer(1, "CT", "B"),
      makePlayer(2, "CT", "C"),
      makePlayer(3, "T", "D"),
      makePlayer(4, "T", "E"),
      makePlayer(5, "T", "F"),
    ];
    const ticks = makeFreezeTicks(6, 3);
    const m = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 0, 3), makeKill(200, 3, 0), makeKill(300, 4, 1), makeKill(400, 5, 2)],
      ticks,
    });
    const { headlines } = playTeamReviewItem(manAdvantageLoss, m);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "advantage",
        text: "Lost 1 with man advantage",
        details: [
          {
            tick: 64,
            roundLabel: "R2",
            text: "Lost with a 3v2 man advantage",
          },
        ],
      },
    ]);
  });

  it("skips losses that never held an advantage", () => {
    const players = [
      makePlayer(0, "CT", "A"),
      makePlayer(1, "CT", "B"),
      makePlayer(2, "T", "C"),
      makePlayer(3, "T", "D"),
    ];
    const ticks = makeFreezeTicks(4, 2);
    const m = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 2, 0), makeKill(200, 3, 1)],
      ticks,
    });
    expect(playTeamReviewItem(manAdvantageLoss, m).headlines).toEqual([]);
  });

  it("skips wins even with an advantage", () => {
    const players = [
      makePlayer(0, "CT", "A"),
      makePlayer(1, "CT", "B"),
      makePlayer(2, "T", "C"),
      makePlayer(3, "T", "D"),
    ];
    const ticks = makeFreezeTicks(4, 2);
    const m = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "CT", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 0, 2), makeKill(200, 1, 3)],
      ticks,
    });
    expect(playTeamReviewItem(manAdvantageLoss, m).headlines).toEqual([]);
  });
});
