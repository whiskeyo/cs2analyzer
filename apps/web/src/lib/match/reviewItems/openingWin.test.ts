import { describe, expect, it } from "vitest";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { openingWin } from "./openingWin";

describe("openingWin", () => {
  it("records a completed opening duel win", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1, { weapon: "ak47", headshot: true })],
    });
    const { notes, headlines } = playReviewItem(openingWin, m);
    expect(notes).toEqual([
      {
        tick: 100,
        roundLabel: "R1",
        title: "Won the opening vs Bob",
        detail: "AK-47 HS",
        severity: "good",
        kind: "opening",
      },
    ]);
    expect(headlines).toEqual([
      { count: 1, severity: "good", kind: "opening", text: "Won 1 opening duel" },
    ]);
  });

  it("skips unfinished rounds and openings the player did not take", () => {
    const live = makeReplay({
      rounds: [makeRound({ number: 1, winner: "CT", end_tick: 640 })],
      kills: [makeKill(100, 0, 1)],
    });
    expect(playReviewItem(openingWin, live, 0, 200).notes).toEqual([]);

    const teammate = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 2, 1)],
    });
    const { notes, headlines } = playReviewItem(openingWin, teammate);
    expect(notes).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
