import { describe, expect, it } from "vitest";
import { GEAR_FLASH, GEAR_HE } from "@/lib/replay/replayTypes";
import { ECO_MAX_EQUIPMENT, MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import {
  makeBlind,
  makeFreezeTicks,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { matchHighlights, playerReview } from "./review";

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

  it("records an eco round win after pistol", () => {
    const ticks = makeFreezeTicks(2, 1, 128);
    ticks.equip[0] = ECO_MAX_EQUIPMENT - 500;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [makeKill(200, 0, 1)],
      ticks,
    });
    const review = playerReview(m, 0, 800);
    expect(review.notes.some((n) => n.title === "Won the round on an eco")).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("eco round"))).toBe(true);
  });
});

describe("playerReview deaths", () => {
  it("flags an opening death and team loss in headlines", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 0)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.title.startsWith("Lost the opening"))).toBe(true);
    expect(
      review.headlines.some((h) => h.text.includes("opening duel") && h.severity === "high"),
    ).toBe(true);
  });

  it("marks untraded deaths", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 2), makeKill(500, 1, 0)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.detail.includes("untraded"))).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("untraded"))).toBe(true);
  });

  it("marks deaths while flashed", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      blinds: [makeBlind(180, 1, 0, MIN_REVIEW_FLASH_SECONDS)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.detail.includes("flashed"))).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("Died flashed"))).toBe(true);
  });

  it("marks utility deaths and low trade damage", () => {
    const util = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0, { weapon: "hegrenade" })],
    });
    expect(playerReview(util, 0, 640).notes.some((n) => n.detail.includes("died to"))).toBe(true);

    const lowTrade = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "T", "C")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 2), makeKill(200, 1, 0, { weapon: "ak47" })],
      hurts: [makeHurt(150, 0, 1, 10)],
    });
    expect(
      playerReview(lowTrade, 0, 640).notes.some((n) => n.detail.includes("only 10 dmg back")),
    ).toBe(true);
  });

  it("notes clutch losses and nades left on death", () => {
    const ticks = makeFreezeTicks(2, 1, 64);
    ticks.gear[0] = GEAR_HE | GEAR_FLASH;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      ticks,
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.detail.includes("lost 1v1"))).toBe(true);
    expect(review.notes.some((n) => n.detail.includes("died holding 2 nades"))).toBe(true);
  });

  it("notes feeding a multi-kill", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "CT", "C"),
        makePlayer(3, "CT", "D"),
      ],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 2), makeKill(120, 1, 3), makeKill(140, 1, 0)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.detail.includes("fed a 3k"))).toBe(true);
  });
});

describe("playerReview highlights", () => {
  it("records an ace", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
        makePlayer(4, "T", "E"),
        makePlayer(5, "T", "F"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [
        makeKill(100, 0, 1),
        makeKill(120, 0, 2),
        makeKill(140, 0, 3),
        makeKill(160, 0, 4),
        makeKill(180, 0, 5),
      ],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.title === "Ace")).toBe(true);
  });

  it("records a clutch win", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(200, 0, 1)],
      ticks: makeFreezeTicks(2, 1, 64),
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.title === "Won a 1v1")).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("Won 1 clutch"))).toBe(true);
  });
});

describe("matchHighlights extras", () => {
  it("lists an ace and eco win", () => {
    const ticks = makeFreezeTicks(6, 1, 64);
    ticks.equip[0] = ECO_MAX_EQUIPMENT - 300;
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
        makePlayer(4, "T", "E"),
        makePlayer(5, "T", "F"),
      ],
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 64, end_tick: 700, start_tick: 0 }),
      ],
      kills: [
        makeKill(100, 0, 1),
        makeKill(120, 0, 2),
        makeKill(140, 0, 3),
        makeKill(160, 0, 4),
        makeKill(180, 0, 5),
      ],
      ticks,
    });
    const highlights = matchHighlights(m, 700);
    expect(highlights.some((h) => h.title === "A ace")).toBe(true);
    expect(highlights.some((h) => h.title === "Eco round win")).toBe(true);
    expect(highlights.some((h) => h.title === "A won a 1v5")).toBe(true);
  });

  it("skips knife rounds", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 0, is_knife: true }), makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const highlights = matchHighlights(m, 640);
    expect(highlights.every((h) => h.roundLabel !== "Knife")).toBe(true);
  });
});
