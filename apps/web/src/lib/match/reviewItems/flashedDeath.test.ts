import { describe, expect, it } from "vitest";
import { makeBlind, makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import { flashedDeath } from "./flashedDeath";

describe("flashedDeath", () => {
  it("tags a flashed death as high and names the flasher", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      blinds: [makeBlind(180, 1, 0, MIN_REVIEW_FLASH_SECONDS)],
    });
    const { drafts, headlines } = playReviewItem(flashedDeath, m);
    expect(drafts[0]?.severity).toBe("high");
    expect(drafts[0]?.bits[0]).toBe(`flashed by Bob (${MIN_REVIEW_FLASH_SECONDS.toFixed(1)}s)`);
    expect(headlines).toEqual([
      { count: 1, severity: "high", kind: "death", text: "Died flashed 1 time" },
    ]);
  });

  it("omits the flasher name for a self-flash and skips deaths with no flash", () => {
    const self = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      blinds: [makeBlind(180, 0, 0, 1)],
    });
    expect(playReviewItem(flashedDeath, self).drafts[0]?.bits[0]).toBe("flashed (1.0s)");

    const clear = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
    });
    const { drafts, headlines } = playReviewItem(flashedDeath, clear);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });
});
