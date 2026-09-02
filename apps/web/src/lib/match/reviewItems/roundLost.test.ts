import { describe, expect, it } from "vitest";
import { makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { roundLost } from "./roundLost";

describe("roundLost", () => {
  it("annotates deaths in rounds the team lost", () => {
    const m = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(roundLost, m);
    expect(drafts[0]?.bits).toEqual(["round lost"]);
    expect(headlines).toEqual([]);
  });

  it("stays quiet when the team wins or the round is still live", () => {
    const won = makeReplay({
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(200, 1, 0)],
    });
    expect(playReviewItem(roundLost, won).drafts[0]?.bits).toEqual([]);

    const live = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T", end_tick: 640 })],
      kills: [makeKill(200, 1, 0)],
    });
    expect(playReviewItem(roundLost, live, 0, 300).drafts[0]?.bits).toEqual([]);
  });
});
