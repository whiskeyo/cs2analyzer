import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { clutchWin } from "./clutchWin";

describe("clutchWin", () => {
  it("records a won 1v1 and jumps to the player's last frag", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(200, 0, 1)],
      ticks: makeFreezeTicks(2, 1),
    });
    const { notes, headlines } = playReviewItem(clutchWin, m);
    expect(notes).toEqual([
      {
        tick: 200,
        roundLabel: "R1",
        title: "Won a 1v1",
        detail: "clutch",
        severity: "good",
        kind: "clutch",
      },
    ]);
    expect(headlines).toEqual([
      { count: 1, severity: "good", kind: "clutch", text: "Won 1 clutch" },
    ]);
  });

  it("skips lost rounds and rounds where the player was never last alive", () => {
    const lost = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      ticks: makeFreezeTicks(2, 1),
    });
    expect(playReviewItem(clutchWin, lost).notes).toEqual([]);

    const four = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "CT", "C"),
        makePlayer(2, "T", "B"),
        makePlayer(3, "T", "D"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      ticks: makeFreezeTicks(4, 2),
      kills: [makeKill(100, 0, 2), makeKill(120, 0, 3)],
    });
    const { notes, headlines } = playReviewItem(clutchWin, four);
    expect(notes).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
