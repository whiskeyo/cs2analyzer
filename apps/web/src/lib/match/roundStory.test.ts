import { describe, expect, it } from "vitest";
import { roundStories } from "./roundStory";
import type { Round } from "@/lib/replay/replayTypes";
import { makeBombEvent, makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";

/** Round stories need a long round: the fixtures run past the default 640. */
function round(partial: Partial<Round> & Pick<Round, "number" | "winner">): Round {
  return makeRound({ end_tick: 2000, win_reason: 9, ...partial });
}

const roster = [
  makePlayer(0, "T", "T1"),
  makePlayer(1, "T", "T2"),
  makePlayer(2, "T", "T3"),
  makePlayer(3, "CT", "CT1"),
  makePlayer(4, "CT", "CT2"),
  makePlayer(5, "CT", "CT3"),
  makePlayer(6, "CT", "CT4"),
  makePlayer(7, "CT", "CT5"),
];

describe("roundStories", () => {
  it("skips the knife round", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 0, winner: "T", is_knife: true, win_reason: 9 })],
      kills: [makeKill(100, 0, 3)],
    });
    expect(roundStories(m)).toEqual([]);
  });

  it("names the opener and T elim ending", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T", win_reason: 9 })],
      kills: [makeKill(120, 0, 3)],
    });
    const stories = roundStories(m);
    expect(stories).toHaveLength(1);
    expect(stories[0].opener).toEqual({ name: "T1", vs: "CT1", tick: 120 });
    expect(stories[0].ending).toBe("T elim");
    expect(stories[0].summary).toContain("T1 opener");
    expect(stories[0].summary).toContain("T elim");
  });

  it("marks a plant win as bomb", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 2, winner: "T", win_reason: 1 })],
      bombEvents: [makeBombEvent({ tick: 800, kind: "planted" })],
    });
    const stories = roundStories(m);
    expect(stories[0].planted).toBe(true);
    expect(stories[0].ending).toBe("bomb");
  });

  it("marks a 5k as an ace", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 3, winner: "T", win_reason: 9 })],
      kills: [
        makeKill(100, 0, 3),
        makeKill(120, 0, 4),
        makeKill(140, 0, 5),
        makeKill(160, 0, 6),
        makeKill(180, 0, 7),
      ],
    });
    const stories = roundStories(m);
    expect(stories[0].ace).toBe(true);
    expect(stories[0].ending).toBe("ace");
  });
});
