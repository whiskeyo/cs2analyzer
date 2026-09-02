import { describe, expect, it } from "vitest";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { mustRoundContext, playReviewItem } from "@/lib/testing/reviewItem";
import type { DeathDraft } from "../review";
import { deathContext } from "./context";
import { deathTrade } from "./deathTrade";

const roster = [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")];

describe("deathTrade", () => {
  it("marks an untraded death as mid", () => {
    const m = makeReplay({
      players: roster,
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 2), makeKill(500, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(deathTrade, m);
    expect(drafts[0]).toMatchObject({ bits: ["untraded"], severity: "mid" });
    expect(headlines).toEqual([
      { count: 1, severity: "mid", kind: "death", text: "1 untraded death" },
    ]);
  });

  it("downgrades a traded opening death from high to mid", () => {
    const m = makeReplay({
      players: roster,
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 0), makeKill(180, 2, 1)],
    });
    const ctx = mustRoundContext(m);
    const draft: DeathDraft = { bits: [], severity: "high" };
    deathTrade.create().applyDeath?.(deathContext(ctx, ctx.myDeaths[0]), draft);
    expect(draft).toMatchObject({ bits: ["traded"], severity: "mid" });
  });

  it("ignores world deaths and does not tag a traded non-opening death", () => {
    const world = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, -1, 0)],
    });
    expect(playReviewItem(deathTrade, world).drafts[0]?.bits).toEqual([]);

    const tradedLater = makeReplay({
      players: roster,
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(80, 1, 2), makeKill(200, 1, 0), makeKill(250, 2, 1)],
    });
    const { drafts, headlines } = playReviewItem(deathTrade, tradedLater);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
