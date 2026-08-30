import { describe, expect, it } from "vitest";
import { matchHighlights, playerReview } from "./review";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";

describe("playerReview", () => {
  it("records winning the opening duel", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.headlines.some((h) => h.text.includes("Won 1 opening"))).toBe(true);
    expect(
      review.notes.some((n) => n.title.startsWith("Won the opening") && n.severity === "good"),
    ).toBe(true);
  });

  it("records a 4k as a highlight", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
        makePlayer(4, "T", "E"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1), makeKill(120, 0, 2), makeKill(140, 0, 3), makeKill(160, 0, 4)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.title === "4k this round")).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("4k+"))).toBe(true);
  });

  it("records trading the opener as a good play", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "T", "T1"),
        makePlayer(1, "T", "T2"),
        makePlayer(2, "CT", "CT1"),
        makePlayer(3, "CT", "CT2"),
      ],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 2, 0), makeKill(180, 1, 2)],
    });
    const review = playerReview(m, 1, 640);
    expect(
      review.notes.some((n) => n.title.startsWith("Traded the opener") && n.severity === "good"),
    ).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("Traded"))).toBe(true);
  });
});

describe("matchHighlights", () => {
  it("lists a 4k and a traded opener as jump targets", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
        makePlayer(4, "T", "E"),
        makePlayer(5, "CT", "F"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [
        makeKill(100, 1, 0),
        makeKill(180, 5, 1),
        makeKill(200, 5, 2),
        makeKill(220, 5, 3),
        makeKill(240, 5, 4),
      ],
    });
    const highlights = matchHighlights(m, 640);
    expect(highlights.some((h) => h.title === "F traded the opener" && h.player === 5)).toBe(true);
    expect(highlights.some((h) => h.title === "F 4k" && h.tick === 240)).toBe(true);
  });

  it("does not copy an eco win once per player", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const ecos = matchHighlights(m, 640).filter((h) => h.title === "Eco round win");
    expect(ecos).toEqual([]);
  });
});

describe("playerReview eco", () => {
  it("does not call a pistol round win an eco", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT", freeze_end_tick: 64, end_tick: 700 })],
      kills: [makeKill(100, 0, 1)],
    });
    const review = playerReview(m, 0, 700);
    expect(review.notes.some((n) => n.title.includes("eco"))).toBe(false);
  });
});
