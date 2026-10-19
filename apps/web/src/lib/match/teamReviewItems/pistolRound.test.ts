import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { pistolRound } from "./pistolRound";

describe("pistolRound", () => {
  it("records pistol wins and losses", () => {
    const ticks = makeFreezeTicks(2, 1);
    ticks.equip[0] = 800;
    ticks.equip[1] = 800;
    const won = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "CT", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 0, 1)],
      ticks,
    });
    expect(playTeamReviewItem(pistolRound, won).headlines).toEqual([
      {
        count: 1,
        severity: "good",
        kind: "eco",
        text: "Won 1 pistol round",
        details: [{ tick: 64, roundLabel: "R1", text: "Won pistol" }],
      },
    ]);

    const lost = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(100, 1, 0)],
      ticks,
    });
    expect(playTeamReviewItem(pistolRound, lost).headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "eco",
        text: "Lost 1 pistol round",
        details: [{ tick: 64, roundLabel: "R1", text: "Lost pistol" }],
      },
    ]);
  });
});
