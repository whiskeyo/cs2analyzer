import { describe, expect, it } from "vitest";
import type { PlayerStats } from "@/lib/replay/replayTypes";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { computeStats, matchEndTick } from "@/lib/stats/stats";
import { reviewHeadshotLine } from "./reviewHeadshot";

function stubStats(
  partial: Pick<PlayerStats, "kills" | "headshots" | "headshot_percent">,
): PlayerStats {
  return partial as PlayerStats;
}

describe("reviewHeadshotLine", () => {
  it("is null without kills", () => {
    expect(reviewHeadshotLine(undefined)).toBeNull();
    expect(reviewHeadshotLine(null)).toBeNull();
    expect(
      reviewHeadshotLine(stubStats({ kills: 0, headshots: 0, headshot_percent: 0 })),
    ).toBeNull();
  });

  it("matches computeStats enemy-kill headshot percent", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1, { headshot: true }), makeKill(200, 0, 1, { headshot: false })],
    });
    const stats = computeStats(replay, matchEndTick(replay))[0];
    expect(reviewHeadshotLine(stats)).toBe("50% HS (1/2)");
  });
});
