import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { clutchConceded } from "./clutchConceded";

describe("clutchConceded", () => {
  it("flags when the opponent wins a 1vX", () => {
    const players = [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
    ];
    const ticks = makeFreezeTicks(3, 2);
    const m = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 640 })],
      // Alice dies → Bob 1v1 vs Cara is not yet; Bob dies → Cara 1v0?
      // Start 2 CT vs 1 T. Kill Alice → 1v1 Bob vs Cara. Cara kills Bob → T wins, Cara clutched 1v1.
      kills: [makeKill(100, 2, 0), makeKill(200, 2, 1)],
      ticks,
    });
    const { headlines } = playTeamReviewItem(clutchConceded, m);
    expect(headlines[0]?.text).toBe("Conceded 1 clutch");
    expect(headlines[0]?.details?.[0]?.text).toBe("Conceded Cara 1v2");
  });
});
