import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { openingDeath } from "./openingDeath";

describe("openingDeath", () => {
  it("tags an opening death as high and counts team-lost rounds in the headline", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(openingDeath, m);
    expect(drafts[0]).toMatchObject({ bits: ["opening death"], severity: "high" });
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "high",
        kind: "opening",
        text: "Lost 1 opening duel (1 in rounds the team lost)",
      },
    ]);
  });

  it("ignores deaths that are not the opening duel", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "T", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      ticks: makeFreezeTicks(3, 1),
      kills: [makeKill(100, 0, 2), makeKill(200, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(openingDeath, m);
    expect(drafts[0]?.bits).toEqual([]);
    expect(drafts[0]?.severity).toBe("low");
    expect(headlines).toEqual([]);
  });

  it("still headlines opening losses when the team wins the round", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 1, 0)],
    });
    const { headlines } = playReviewItem(openingDeath, m);
    expect(headlines[0]?.text).toBe("Lost 1 opening duel");
  });
});
