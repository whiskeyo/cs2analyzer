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
import { finishReview, playerReview, sortReviewNotes } from "./review";

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

  it("skips knife rounds and suicide deaths", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 0, is_knife: true, start_tick: 0, freeze_end_tick: 10, end_tick: 50 }),
        makeRound({ number: 1, winner: "T", start_tick: 50, freeze_end_tick: 100, end_tick: 800 }),
      ],
      kills: [makeKill(20, 1, 0), makeKill(200, 0, 0), makeKill(300, 1, 0)],
    });
    const review = playerReview(m, 0, 800);
    expect(review.notes.every((n) => n.tick >= 100)).toBe(true);
    expect(review.notes.some((n) => n.tick === 20)).toBe(false);
    expect(review.notes.some((n) => n.tick === 200)).toBe(false);
    expect(review.notes.some((n) => n.tick === 300)).toBe(true);
  });

  it("stacks death-note bits in REVIEW_ITEMS order", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "CT", "C"), makePlayer(2, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks: makeFreezeTicks(3, 2),
      kills: [makeKill(100, 2, 0)],
    });
    const death = playerReview(m, 0, 640).notes.find((n) => n.tick === 100);
    expect(death?.detail.split(" · ").slice(1)).toEqual([
      "opening death",
      "untraded",
      "no damage back",
      "round lost",
    ]);
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
    expect(review.notes.find((n) => n.title === "Won a 1v1")?.kind).toBe("clutch");
  });

  it("records a clutch loss", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "T", "C")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 700 }),
      ],
      kills: [makeKill(200, 1, 0)],
      ticks: makeFreezeTicks(3, 1, 64),
    });
    const review = playerReview(m, 0, 700);
    expect(
      review.headlines.some((h) => h.kind === "clutch" && h.text.includes("Lost 1 clutch")),
    ).toBe(true);
    expect(review.notes.some((n) => n.detail.includes("lost 1v"))).toBe(true);
  });
});

describe("finishReview", () => {
  it("builds headlines from collectors instead of a central count table", () => {
    const review = finishReview(
      [
        {
          headlines: () => [
            {
              text: "Won 1 clutch",
              severity: "good",
              kind: "clutch",
              count: 1,
            },
          ],
        },
        { headlines: () => [] },
      ],
      [],
    );
    expect(review.headlines).toEqual([
      { text: "Won 1 clutch", severity: "good", kind: "clutch", count: 1 },
    ]);
  });

  it("sorts notes by round tick or by worst-first severity", () => {
    const notes = [
      {
        tick: 100,
        roundLabel: "R1",
        title: "Won the opening",
        detail: "",
        severity: "good" as const,
        kind: "opening" as const,
      },
      {
        tick: 200,
        roundLabel: "R2",
        title: "Died",
        detail: "",
        severity: "high" as const,
        kind: "death" as const,
      },
      {
        tick: 250,
        roundLabel: "R2b",
        title: "Died later",
        detail: "",
        severity: "high" as const,
        kind: "death" as const,
      },
      {
        tick: 280,
        roundLabel: "R2c",
        title: "Fed",
        detail: "",
        severity: "mid" as const,
        kind: "death" as const,
      },
      {
        tick: 300,
        roundLabel: "R3",
        title: "Unused nades",
        detail: "",
        severity: "low" as const,
        kind: "death" as const,
      },
    ];
    expect(sortReviewNotes(notes, "round").map((n) => n.roundLabel)).toEqual([
      "R1",
      "R2",
      "R2b",
      "R2c",
      "R3",
    ]);
    expect(sortReviewNotes(notes, "severity").map((n) => n.roundLabel)).toEqual([
      "R2",
      "R2b",
      "R2c",
      "R3",
      "R1",
    ]);
    expect(notes.map((n) => n.roundLabel)).toEqual(["R1", "R2", "R2b", "R2c", "R3"]);
  });

  it("orders headlines good-then-bad and notes by tick", () => {
    const review = finishReview(
      [
        {
          headlines: () => [
            { text: "Lost 1 opening duel", severity: "high", kind: "opening", count: 1 },
            { text: "3 untraded deaths", severity: "mid", kind: "death", count: 3 },
          ],
        },
        {
          headlines: () => [
            { text: "Won 2 opening duels", severity: "good", kind: "opening", count: 2 },
          ],
        },
      ],
      [
        {
          tick: 200,
          roundLabel: "R2",
          title: "Won the opening",
          detail: "",
          severity: "good",
          kind: "opening",
        },
        {
          tick: 50,
          roundLabel: "R1",
          title: "Died",
          detail: "",
          severity: "high",
          kind: "death",
        },
      ],
    );
    expect(review.headlines.map((h) => h.text)).toEqual([
      "Won 2 opening duels",
      "Lost 1 opening duel",
      "3 untraded deaths",
    ]);
    expect(review.notes.map((n) => n.tick)).toEqual([50, 200]);
  });

  it("lists notes in tick order instead of good-then-bad", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
        makeRound({
          number: 2,
          winner: "CT",
          start_tick: 641,
          freeze_end_tick: 700,
          end_tick: 1400,
        }),
      ],
      kills: [makeKill(100, 1, 0), makeKill(800, 0, 1)],
    });
    const review = playerReview(m, 0, 1400);
    expect(review.notes.map((n) => n.tick)).toEqual(
      [...review.notes.map((n) => n.tick)].sort((a, b) => a - b),
    );
    expect(review.notes[0]?.severity).not.toBe("good");
    expect(review.notes.some((n) => n.severity === "good")).toBe(true);
  });
});
