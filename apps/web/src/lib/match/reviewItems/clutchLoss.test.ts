import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { clutchLoss } from "./clutchLoss";

describe("clutchLoss", () => {
  it("tags a last-alive death as a lost clutch", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks: makeFreezeTicks(2, 1),
      kills: [makeKill(200, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(clutchLoss, m);
    expect(drafts[0]).toMatchObject({ bits: ["lost 1v1"], severity: "high" });
    expect(headlines).toEqual([
      { count: 1, severity: "high", kind: "clutch", text: "Lost 1 clutch" },
    ]);
  });

  it("ignores deaths while a teammate is still alive", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "CT", "C"), makePlayer(2, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks: makeFreezeTicks(3, 2),
      kills: [makeKill(200, 2, 0)],
    });
    const { drafts, headlines } = playReviewItem(clutchLoss, m);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
