import { describe, expect, it } from "vitest";
import { makeHurt, makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { lowReturn } from "./lowReturn";

describe("lowReturn", () => {
  it("tags gunfights with no damage or under 25 damage back", () => {
    const none = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
    });
    expect(playReviewItem(lowReturn, none).drafts[0]).toMatchObject({
      bits: ["no damage back"],
      severity: "mid",
    });

    const some = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      hurts: [makeHurt(150, 0, 1, 10)],
    });
    const { drafts, headlines } = playReviewItem(lowReturn, some);
    expect(drafts[0]?.bits).toEqual(["only 10 dmg back"]);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "mid",
        kind: "death",
        text: "1 gunfight with almost no damage back",
      },
    ]);
  });

  it("skips util deaths and gunfights with at least 25 damage back", () => {
    const util = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0, { weapon: "hegrenade" })],
    });
    expect(playReviewItem(lowReturn, util).drafts[0]?.bits).toEqual([]);

    const enough = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      hurts: [makeHurt(150, 0, 1, 25)],
    });
    const { drafts, headlines } = playReviewItem(lowReturn, enough);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });

  it("ignores world deaths", () => {
    const m = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, -1, 0)],
    });
    expect(playReviewItem(lowReturn, m).drafts[0]?.bits).toEqual([]);
  });
});
