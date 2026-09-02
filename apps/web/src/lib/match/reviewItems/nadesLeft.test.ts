import { describe, expect, it } from "vitest";
import { GEAR_FLASH, GEAR_HE, GEAR_SMOKE } from "@/lib/replay/replayTypes";
import { makeFreezeTicks, makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { nadesLeft } from "./nadesLeft";

describe("nadesLeft", () => {
  it("tags dying with at least two unused nades", () => {
    const ticks = makeFreezeTicks(2, 1);
    ticks.gear[0] = GEAR_HE | GEAR_FLASH | GEAR_SMOKE;
    const m = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      ticks,
    });
    const { drafts, headlines } = playReviewItem(nadesLeft, m);
    expect(drafts[0]?.bits).toEqual(["died holding 3 nades"]);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "low",
        kind: "death",
        text: "Died holding unused nades 1 time",
      },
    ]);
  });

  it("ignores one nade, empty gear, and missing tick samples", () => {
    const one = makeFreezeTicks(2, 1);
    one.gear[0] = GEAR_HE;
    expect(
      playReviewItem(
        nadesLeft,
        makeReplay({
          rounds: [makeRound({ number: 1, winner: "T" })],
          kills: [makeKill(200, 1, 0)],
          ticks: one,
        }),
      ).drafts[0]?.bits,
    ).toEqual([]);

    const empty = makeFreezeTicks(2, 1);
    expect(
      playReviewItem(
        nadesLeft,
        makeReplay({
          rounds: [makeRound({ number: 1, winner: "T" })],
          kills: [makeKill(200, 1, 0)],
          ticks: empty,
        }),
      ).drafts[0]?.bits,
    ).toEqual([]);

    const { drafts, headlines } = playReviewItem(
      nadesLeft,
      makeReplay({
        rounds: [makeRound({ number: 1, winner: "T" })],
        kills: [makeKill(200, 1, 0)],
      }),
    );
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
