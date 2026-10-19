import { describe, expect, it } from "vitest";
import {
  makeBombEvent,
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { postPlantLoss } from "./postPlantLoss";

describe("postPlantLoss", () => {
  it("flags a T loss after plant", () => {
    const ticks = makeFreezeTicks(2, 1);
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 2, winner: "CT", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(300, 0, 1)],
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", player: 1 })],
      ticks,
    });
    expect(playTeamReviewItem(postPlantLoss, m, "T").headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "death",
        text: "Lost 1 post-plant / retake round",
        details: [{ tick: 104, roundLabel: "R2", text: "Lost after planting" }],
      },
    ]);
  });

  it("flags a CT failed retake", () => {
    const ticks = makeFreezeTicks(2, 1);
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(300, 1, 0)],
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", player: 1 })],
      ticks,
    });
    expect(playTeamReviewItem(postPlantLoss, m, "CT").headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "death",
        text: "Lost 1 post-plant / retake round",
        details: [{ tick: 104, roundLabel: "R2", text: "Failed the retake" }],
      },
    ]);
  });
});
