import { describe, expect, it } from "vitest";
import {
  makeBlind,
  makeFreezeTicks,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { MIN_REVIEW_FLASH_SECONDS, TRADE_SECONDS } from "@/lib/shared/constants";
import type { DeathDraft } from "../review";
import {
  aliveOnSide,
  atLeastMid,
  clutchVs,
  countHeadline,
  dmgTo,
  flashedAt,
  goodNote,
  isUtil,
  plural,
  roundLabel,
  setHigh,
  traded,
} from "./support";
import { mustRoundContext } from "@/lib/testing/reviewItem";

describe("roundLabel", () => {
  it("uses Knife for knife rounds and R# otherwise", () => {
    expect(roundLabel(makeRound({ number: 0, is_knife: true }))).toBe("Knife");
    expect(roundLabel(makeRound({ number: 15 }))).toBe("R15");
  });
});

describe("isUtil", () => {
  it("matches HE, molly, and inferno names", () => {
    expect(isUtil("hegrenade")).toBe(true);
    expect(isUtil("weapon_hegrenade")).toBe(true);
    expect(isUtil("inferno")).toBe(true);
    expect(isUtil("molotov")).toBe(true);
    expect(isUtil("incgrenade")).toBe(true);
    expect(isUtil("ak47")).toBe(false);
    expect(isUtil("flashbang")).toBe(false);
  });
});

describe("flashedAt", () => {
  it("returns the enemy flash covering the tick", () => {
    const m = makeReplay({
      blinds: [makeBlind(180, 1, 0, MIN_REVIEW_FLASH_SECONDS)],
    });
    expect(flashedAt(m, 0, 200)).toEqual({
      by: 1,
      duration: MIN_REVIEW_FLASH_SECONDS,
    });
  });

  it("ignores short flashes and flashes that already ended", () => {
    const m = makeReplay({
      blinds: [makeBlind(100, 1, 0, 0.2), makeBlind(100, 1, 0, 1)],
    });
    expect(flashedAt(m, 0, 100)).toEqual({ by: 1, duration: 1 });
    expect(flashedAt(m, 0, 400)).toBeNull();
  });

  it("prefers an enemy flash over a teammate flash in the same window", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      blinds: [makeBlind(180, 2, 0, 1), makeBlind(185, 1, 0, 1.5)],
    });
    expect(flashedAt(m, 0, 200)).toEqual({ by: 1, duration: 1.5 });
  });

  it("falls back to a teammate flash when no enemy flash hits", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      blinds: [makeBlind(180, 2, 0, 1)],
    });
    expect(flashedAt(m, 0, 200)).toEqual({ by: 2, duration: 1 });
  });
});

describe("traded", () => {
  it("is a teammate killing the attacker inside the trade window", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      kills: [makeKill(100, 1, 0), makeKill(180, 2, 1)],
    });
    expect(traded(m, m.kills[0], 640)).toBe(true);
  });

  it("rejects world deaths, late trades, and trades after untilTick", () => {
    const death = makeKill(100, 1, 0);
    const world = makeKill(100, -1, 0);
    const late = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      kills: [death, makeKill(100 + Math.round(TRADE_SECONDS * 64) + 1, 2, 1)],
    });
    const clipped = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      kills: [death, makeKill(180, 2, 1)],
    });
    expect(traded(makeReplay({ kills: [world] }), world, 640)).toBe(false);
    expect(traded(late, death, 640)).toBe(false);
    expect(traded(clipped, death, 150)).toBe(false);
  });
});

describe("dmgTo", () => {
  it("sums hurts from attacker to victim in [from, to]", () => {
    const m = makeReplay({
      hurts: [makeHurt(50, 0, 1, 10), makeHurt(100, 0, 1, 15), makeHurt(200, 0, 1, 20)],
    });
    expect(dmgTo(m, 0, 1, 64, 150)).toBe(15);
    expect(dmgTo(m, 0, 1, 64, 200)).toBe(35);
    expect(dmgTo(m, 1, 0, 64, 200)).toBe(0);
  });
});

describe("aliveOnSide", () => {
  it("counts living pawns on a side and can skip one index", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "CT", "C"),
        makePlayer(2, "T", "B"),
        makePlayer(3, "T", "D"),
      ],
      ticks: makeFreezeTicks(4, 2),
    });
    expect(aliveOnSide(m, 64, "CT", -1)).toBe(2);
    expect(aliveOnSide(m, 64, "CT", 0)).toBe(1);
    expect(aliveOnSide(m, 64, "T", -1)).toBe(2);
    expect(aliveOnSide(makeReplay(), 64, "CT", -1)).toBe(0);
  });
});

describe("clutchVs", () => {
  it("returns 0 with no freeze snapshot or when the player was never last alive", () => {
    const empty = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    expect(clutchVs(empty, empty.rounds[0], empty.kills, 0, "CT")).toBe(0);

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
    expect(clutchVs(four, four.rounds[0], four.kills, 0, "CT")).toBe(0);
  });

  it("tracks the largest 1vX after the last teammate dies", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "CT", "Bob"),
        makePlayer(2, "T", "T1"),
        makePlayer(3, "T", "T2"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      ticks: makeFreezeTicks(4, 2),
      kills: [makeKill(200, 2, 1), makeKill(400, 0, 2), makeKill(500, 0, 3)],
    });
    expect(clutchVs(m, m.rounds[0], m.kills, 0, "CT")).toBe(2);
  });
});

describe("headline helpers", () => {
  it("pluralizes, upgrades severity, and skips zero counts", () => {
    expect(plural(1, "duel", "duels")).toBe("duel");
    expect(plural(2, "duel", "duels")).toBe("duels");

    const draft: DeathDraft = { bits: [], severity: "low" };
    atLeastMid(draft);
    expect(draft.severity).toBe("mid");
    atLeastMid(draft);
    expect(draft.severity).toBe("mid");
    setHigh(draft);
    expect(draft.severity).toBe("high");
    atLeastMid(draft);
    expect(draft.severity).toBe("high");

    expect(countHeadline(0, "good", "opening", "Won 0")).toEqual([]);
    expect(countHeadline(2, "high", "opening", "Lost 2 opening duels")).toEqual([
      { count: 2, severity: "high", kind: "opening", text: "Lost 2 opening duels" },
    ]);
  });

  it("builds a good note from the round context", () => {
    const m = makeReplay({
      rounds: [makeRound({ number: 7, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const ctx = mustRoundContext(m);
    expect(goodNote(ctx, 100, "opening", "Won the opening vs B", "AK")).toEqual({
      tick: 100,
      roundLabel: "R7",
      title: "Won the opening vs B",
      detail: "AK",
      severity: "good",
      kind: "opening",
    });
  });
});
