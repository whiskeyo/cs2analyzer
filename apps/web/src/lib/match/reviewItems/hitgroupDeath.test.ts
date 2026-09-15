import { describe, expect, it } from "vitest";
import { HITGROUP_CHEST, HITGROUP_GENERIC, HITGROUP_HEAD } from "@/lib/shared/constants";
import { makeHurt, makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { playReviewItem } from "@/lib/testing/reviewItem";
import { hitgroupDeath } from "./hitgroupDeath";

describe("hitgroupDeath", () => {
  it("names the killing-blow hitgroup from the last enemy hurt", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      hurts: [
        makeHurt(150, 1, 0, 34, { hitgroup: HITGROUP_CHEST }),
        makeHurt(200, 1, 0, 40, { hitgroup: HITGROUP_CHEST }),
      ],
    });
    const { drafts, headlines } = playReviewItem(hitgroupDeath, m);
    expect(drafts[0]?.bits).toEqual(["chest"]);
    expect(headlines).toEqual([]);
  });

  it("adds earlier head tags and a headline when they were tagged in the head", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0, { headshot: true })],
      hurts: [
        makeHurt(120, 1, 0, 20, { hitgroup: HITGROUP_HEAD }),
        makeHurt(200, 1, 0, 89, { hitgroup: HITGROUP_HEAD }),
      ],
    });
    const { drafts, headlines } = playReviewItem(hitgroupDeath, m);
    expect(drafts[0]?.bits).toEqual(["head", "tagged in head"]);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "low",
        kind: "death",
        text: "Tagged in the head before 1 death",
      },
    ]);
  });

  it("skips generic hitgroups, teammates, and deaths with no hurts", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "CT", "C"), makePlayer(2, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 2, 0)],
      hurts: [
        makeHurt(180, 1, 0, 10, { hitgroup: HITGROUP_CHEST }),
        makeHurt(200, 2, 0, 50, { hitgroup: HITGROUP_GENERIC }),
      ],
    });
    const { drafts, headlines } = playReviewItem(hitgroupDeath, m);
    expect(drafts[0]?.bits).toEqual([]);
    expect(headlines).toEqual([]);
  });

  it("counts two prior head tags when the kill shot is not a headshot", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(200, 1, 0)],
      hurts: [
        makeHurt(100, 1, 0, 15, { hitgroup: HITGROUP_HEAD }),
        makeHurt(140, 1, 0, 15, { hitgroup: HITGROUP_HEAD }),
        makeHurt(200, 1, 0, 34, { hitgroup: HITGROUP_CHEST }),
      ],
    });
    expect(playReviewItem(hitgroupDeath, m).drafts[0]?.bits).toEqual([
      "chest",
      "tagged in head 2 times",
    ]);
  });
});
