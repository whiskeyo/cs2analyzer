import { describe, expect, it } from "vitest";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { multiKill } from "./multiKill";

function tSide(n: number) {
  return [
    makePlayer(0, "CT", "A"),
    ...Array.from({ length: n }, (_, i) => makePlayer(i + 1, "T", `T${i + 1}`)),
  ];
}

describe("multiKill", () => {
  it("records a 4k", () => {
    const m = makeReplay({
      players: tSide(4),
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1), makeKill(120, 0, 2), makeKill(140, 0, 3), makeKill(160, 0, 4)],
    });
    const { notes, headlines } = playReviewItem(multiKill, m);
    expect(notes[0]).toMatchObject({
      tick: 160,
      title: "4k this round",
      kind: "multi",
      severity: "good",
    });
    expect(notes[0]?.detail).toBe("AK-47, AK-47, AK-47, AK-47");
    expect(headlines).toEqual([
      { count: 1, severity: "good", kind: "multi", text: "1 round with 4k+" },
    ]);
  });

  it("records an ace and skips a 3k", () => {
    const ace = makeReplay({
      players: tSide(5),
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [
        makeKill(100, 0, 1),
        makeKill(120, 0, 2),
        makeKill(140, 0, 3),
        makeKill(160, 0, 4),
        makeKill(180, 0, 5),
      ],
    });
    expect(playReviewItem(multiKill, ace).notes[0]?.title).toBe("Ace");

    const three = makeReplay({
      players: tSide(3),
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1), makeKill(120, 0, 2), makeKill(140, 0, 3)],
    });
    const { notes, headlines } = playReviewItem(multiKill, three);
    expect(notes).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
