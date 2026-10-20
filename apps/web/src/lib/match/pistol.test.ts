import { describe, expect, it } from "vitest";
import type { MatchInfo, Side } from "@/lib/replay/replayTypes";
import { sampleMatchInfo } from "@/lib/testing/fixtures";
import type { TimelineRoundRoster } from "@/lib/stats/timelineChart";
import { economyBreakAfter } from "@/lib/stats/timelineChart";
import { isPistolRound } from "./pistol";

describe("isPistolRound", () => {
  it("marks MR12 pistols at round 1 and 13, never later regulation or overtime", () => {
    const info = maxRounds(24);
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(13, info)).toBe(true);
    for (const round of [2, 12, 14, 24]) {
      expect(isPistolRound(round, info)).toBe(false);
    }
    for (let round = 25; round <= 36; round += 1) {
      expect(isPistolRound(round, info)).toBe(false);
    }
  });

  it("marks an MR8 (mp_maxrounds 16) at round 1 and 9", () => {
    const info = maxRounds(16);
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(9, info)).toBe(true);
    expect(isPistolRound(8, info)).toBe(false);
    expect(isPistolRound(10, info)).toBe(false);
    expect(isPistolRound(13, info)).toBe(false);
    expect(isPistolRound(17, info)).toBe(false);
  });

  it("marks an MR15 (mp_maxrounds 30) at round 1 and 16", () => {
    const info = maxRounds(30);
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(16, info)).toBe(true);
    expect(isPistolRound(15, info)).toBe(false);
    expect(isPistolRound(13, info)).toBe(false);
    expect(isPistolRound(17, info)).toBe(false);
    expect(isPistolRound(31, info)).toBe(false);
  });

  it("defaults a missing mp_maxrounds to 24", () => {
    const info = sampleMatchInfo();
    delete info.convars.demo.mp_maxrounds;
    delete info.convars.defaults.mp_maxrounds;
    info.convar_updates = [];
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(13, info)).toBe(true);
    expect(isPistolRound(16, info)).toBe(false);
    expect(isPistolRound(25, info)).toBe(false);
    expect(isPistolRound(1, undefined)).toBe(true);
    expect(isPistolRound(13, undefined)).toBe(true);
    expect(isPistolRound(25, undefined)).toBe(false);
  });

  it("treats an unreadable mp_maxrounds as the 24 default", () => {
    for (const raw of ["nope", "24.0", ""]) {
      const info = maxRoundsRaw(raw);
      expect(isPistolRound(13, info)).toBe(true);
      expect(isPistolRound(25, info)).toBe(false);
    }
  });

  it("treats mp_maxrounds 0 as no round limit: only round 1", () => {
    const info = maxRounds(0);
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(2, info)).toBe(false);
    expect(isPistolRound(13, info)).toBe(false);
    expect(isPistolRound(25, info)).toBe(false);
  });

  it("treats a negative mp_maxrounds as no round limit: only round 1", () => {
    const info = maxRoundsRaw("-8");
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(13, info)).toBe(false);
    expect(isPistolRound(16, info)).toBe(false);
    expect(isPistolRound(25, info)).toBe(false);
  });

  it("drops the second pistol when mp_halftime is 0", () => {
    const info = maxRounds(24);
    info.convars.demo.mp_halftime = "0";
    expect(isPistolRound(1, info)).toBe(true);
    expect(isPistolRound(13, info)).toBe(false);
    const swapped = blocks(["CT", 12], ["T", 12]);
    expect(isPistolRound(13, info, { rounds: swapped })).toBe(false);
    expect(isPistolRound(1, info, { rounds: swapped })).toBe(true);
  });

  it("keeps only round 1 and 13 in a 22-20 overtime match", () => {
    const info = maxRounds(24, "6");
    const rounds = blocks(["T", 12], ["CT", 15], ["T", 6], ["CT", 6], ["T", 3]);
    expect(rounds).toHaveLength(42);
    const pistols: number[] = [];
    for (let round = 1; round <= 42; round += 1) {
      if (isPistolRound(round, info, { rounds })) pistols.push(round);
    }
    expect(pistols).toEqual([1, 13]);
    expect(economyBreakAfter(rounds, info).find((boundary) => boundary < 24)).toBe(12);
    expect(isPistolRound(13, info, { rounds })).toBe(true);
  });

  it("prefers a regulation side swap over the mp_maxrounds midpoint", () => {
    const info = maxRounds(24);
    const rounds = blocks(["CT", 10], ["T", 6], ["CT", 8]);
    expect(isPistolRound(11, info, { rounds })).toBe(true);
    expect(isPistolRound(13, info)).toBe(true);
    expect(isPistolRound(13, info, { rounds })).toBe(false);
    expect(isPistolRound(17, info, { rounds })).toBe(false);
    expect(isPistolRound(25, info, { rounds })).toBe(false);
  });

  it("reads mp_maxrounds in effect at the round tick", () => {
    const info = sampleMatchInfo();
    info.convars.demo.mp_maxrounds = "24";
    info.convar_updates = [
      { tick: 0, name: "mp_maxrounds", value: "30" },
      { tick: 5000, name: "mp_maxrounds", value: "16" },
      { tick: 9000, name: "mp_halftime", value: "0" },
    ];
    expect(isPistolRound(16, info, { tick: 100 })).toBe(true);
    expect(isPistolRound(13, info, { tick: 100 })).toBe(false);
    expect(isPistolRound(31, info, { tick: 100 })).toBe(false);
    expect(isPistolRound(9, info, { tick: 5000 })).toBe(true);
    expect(isPistolRound(16, info, { tick: 5000 })).toBe(false);
    expect(isPistolRound(13, info)).toBe(true);
    expect(isPistolRound(13, info, { tick: 9000 })).toBe(false);
    expect(isPistolRound(1, info, { tick: 9000 })).toBe(true);
  });
});

function maxRounds(max: number, overtime?: string): MatchInfo {
  return maxRoundsRaw(String(max), overtime);
}

function maxRoundsRaw(max: string, overtime?: string): MatchInfo {
  const base = sampleMatchInfo();
  const demo: Record<string, string> = { mp_maxrounds: max };
  if (overtime != null) demo.mp_overtime_maxrounds = overtime;
  return {
    ...base,
    convars: {
      defaults: { ...base.convars.defaults, mp_maxrounds: max },
      demo,
    },
    convar_updates: [],
  };
}

function blocks(...parts: readonly (readonly [Side, number])[]): TimelineRoundRoster[] {
  const rounds: TimelineRoundRoster[] = [];
  let number = 1;
  for (const [side, count] of parts) {
    for (let i = 0; i < count; i += 1) {
      rounds.push({ number, players: [{ player: 0, side }] });
      number += 1;
    }
  }
  return rounds;
}
