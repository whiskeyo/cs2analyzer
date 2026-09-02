import { describe, expect, it } from "vitest";
import { TRADE_SECONDS } from "@/lib/shared/constants";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { tradedOpener } from "./tradedOpener";

describe("tradedOpener", () => {
  it("records trading the opening killer inside the trade window", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "T", "T1"),
        makePlayer(1, "T", "T2"),
        makePlayer(2, "CT", "CT1"),
        makePlayer(3, "CT", "CT2"),
      ],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 2, 0), makeKill(180, 1, 2, { weapon: "ak47", headshot: true })],
    });
    const { notes, headlines } = playReviewItem(tradedOpener, m, 1);
    expect(notes).toEqual([
      {
        tick: 180,
        roundLabel: "R1",
        title: "Traded the opener (T1)",
        detail: "AK-47 HS",
        severity: "good",
        kind: "opening",
      },
    ]);
    expect(headlines).toEqual([
      { count: 1, severity: "good", kind: "opening", text: "Traded 1 opener" },
    ]);
  });

  it("skips late trades, self as opener, and self as opening killer", () => {
    const lateTick = 100 + Math.round(TRADE_SECONDS * 64) + 1;
    const late = makeReplay({
      players: [makePlayer(0, "T", "T1"), makePlayer(1, "T", "T2"), makePlayer(2, "CT", "CT1")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 2, 0), makeKill(lateTick, 1, 2)],
    });
    expect(playReviewItem(tradedOpener, late, 1).notes).toEqual([]);

    const died = makeReplay({
      players: [makePlayer(0, "T", "T1"), makePlayer(1, "CT", "CT1")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 1, 0)],
    });
    expect(playReviewItem(tradedOpener, died, 0).notes).toEqual([]);

    const took = makeReplay({
      players: [makePlayer(0, "T", "T1"), makePlayer(1, "CT", "CT1")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 0, 1)],
    });
    const { notes, headlines } = playReviewItem(tradedOpener, took, 0);
    expect(notes).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
