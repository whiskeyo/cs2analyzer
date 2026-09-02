import { describe, expect, it } from "vitest";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { fedMulti } from "./fedMulti";

describe("fedMulti", () => {
  it("tags feeding a 3k as mid", () => {
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
    const { drafts, headlines } = playReviewItem(fedMulti, m);
    expect(drafts[0]).toMatchObject({ bits: ["fed a 3k"], severity: "mid" });
    expect(headlines).toEqual([
      { count: 1, severity: "mid", kind: "death", text: "Fed 1 multi-kill" },
    ]);
  });

  it("ignores world deaths and killers with fewer than 3 frags", () => {
    const world = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, -1, 0)],
    });
    expect(playReviewItem(fedMulti, world).drafts[0]?.bits).toEqual([]);

    const two = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(100, 1, 2), makeKill(140, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(fedMulti, two);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
