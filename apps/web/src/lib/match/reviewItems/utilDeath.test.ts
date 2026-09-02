import { describe, expect, it } from "vitest";
import { makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { utilDeath } from "./utilDeath";

describe("utilDeath", () => {
  it("tags HE and molly deaths as mid", () => {
    const he = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0, { weapon: "hegrenade" })],
    });
    const { drafts, headlines } = playReviewItem(utilDeath, he);
    expect(drafts[0]).toMatchObject({ bits: ["died to HE"], severity: "mid" });
    expect(headlines).toEqual([
      { count: 1, severity: "mid", kind: "death", text: "Died to utility 1 time" },
    ]);

    const molly = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0, { weapon: "inferno" })],
    });
    expect(playReviewItem(utilDeath, molly).drafts[0]?.bits).toEqual(["died to Molly"]);
  });

  it("ignores gun deaths", () => {
    const m = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0, { weapon: "ak47" })],
    });
    const { drafts, headlines } = playReviewItem(utilDeath, m);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
