import { describe, expect, it } from "vitest";
import { HE_BURST_SECONDS, KILL_LINE_MIN_LENGTH } from "@/lib/shared/constants";
import {
  blindsAt,
  formatBlindLeft,
  firesAt,
  HIT_SECONDS,
  hitsAt,
  killLineEnds,
  lingerRemaining,
  nadeBurstSpan,
  nadeLandPos,
  nadePopTick,
  nadeVisibleEnd,
  nadesForSummary,
  openingDuel,
  shortenSegment,
} from "./radarFx";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type GrenadeThrow } from "@/lib/replay/replayTypes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import {
  makeGrenade,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";

/** Smoke that pops at 100 and lingers the full 18s. */
function smoke(partial: Partial<GrenadeThrow> = {}): GrenadeThrow {
  return makeGrenade({ kind: "smoke", end_tick: 100 + 64 * 18, ...partial });
}

/** Molotov that pops at 100 and burns the full 7s. */
function molotov(partial: Partial<GrenadeThrow> = {}): GrenadeThrow {
  return makeGrenade({ kind: "molotov", end_tick: 100 + 64 * 7, ...partial });
}

describe("blindsAt", () => {
  it("returns remaining flash time for the victim", () => {
    const blinds = [{ tick: 100, attacker: 1, victim: 0, duration: 2 }];
    expect(blindsAt(blinds, 99, 64).get(0)).toBeUndefined();
    expect(blindsAt(blinds, 100, 64).get(0)).toBeCloseTo(2, 5);
    expect(blindsAt(blinds, 100 + 64, 64).get(0)).toBeCloseTo(1, 5);
    expect(blindsAt(blinds, 100 + 64 * 2, 64).get(0)).toBeUndefined();
  });

  it("keeps the longest overlapping flash", () => {
    const blinds = [
      { tick: 100, attacker: 1, victim: 0, duration: 0.5 },
      { tick: 110, attacker: 2, victim: 0, duration: 2 },
    ];
    expect(blindsAt(blinds, 120, 64).get(0)).toBeCloseTo(2 - 10 / 64, 5);
  });

  it("formats remaining flash time for the radar label", () => {
    expect(formatBlindLeft(1.42)).toBe("1.4s");
    expect(formatBlindLeft(0.05)).toBe("0.1s");
  });
});

describe("hitsAt", () => {
  it("tracks the latest hit inside the pulse window", () => {
    const hurts = [
      { tick: 50, attacker: 1, victim: 0, damage: 20, weapon: "ak47" },
      { tick: 100, attacker: 1, victim: 0, damage: 40, weapon: "ak47" },
    ];
    expect(hitsAt(hurts, 100, 64)?.get(0)).toEqual({ age: 0, damage: 40 });
    expect(hitsAt(hurts, 100 + 64 * 0.2, 64)?.get(0)?.damage).toBe(40);
    expect(hitsAt(hurts, 100 + 64 * (HIT_SECONDS + 0.05), 64).get(0)).toBeUndefined();
  });
});

describe("lingerRemaining", () => {
  it("is full at pop and empty at expiry", () => {
    expect(lingerRemaining(100, 100 + 64 * 18, 100)).toBe(1);
    expect(lingerRemaining(100, 100 + 64 * 18, 100 + 64 * 9)).toBeCloseTo(0.5, 5);
    expect(lingerRemaining(100, 100 + 64 * 18, 100 + 64 * 18)).toBe(0);
    expect(lingerRemaining(100, 100, 100)).toBe(0);
  });
});

describe("nadeBurstSpan", () => {
  it("keeps HE on the radar longer than a flash pop", () => {
    expect(nadeBurstSpan("he", 64)).toBe(Math.round(HE_BURST_SECONDS * 64));
    expect(nadeBurstSpan("flash", 64)).toBeLessThan(nadeBurstSpan("he", 64));
    expect(nadeBurstSpan("smoke", 64)).toBe(0);
  });
});

describe("firesAt", () => {
  it("keeps cells whose lifetime covers the tick", () => {
    const fires = [
      { x: 1, y: 2, start_tick: 100, end_tick: 200 },
      { x: 3, y: 4, start_tick: 150, end_tick: 180 },
    ];
    expect(firesAt(fires, 99)).toEqual([]);
    expect(firesAt(fires, 120)).toEqual([fires[0]]);
    expect(firesAt(fires, 160)).toEqual(fires);
    expect(firesAt(fires, 200)).toEqual([fires[0]]);
    expect(firesAt(fires, 201)).toEqual([]);
    expect(firesAt(undefined, 160)).toEqual([]);
  });
});

describe("nadeVisibleEnd", () => {
  it("caps a stretched end_tick at 18s from pop", () => {
    const g = smoke({ end_tick: 50_000 });
    expect(nadeVisibleEnd(g, 64)).toBe(100 + 64 * 18);
  });

  it("hides when occupancy dies early (molly hole)", () => {
    const g = molotov({
      fires: [{ x: 0, y: 0, start_tick: 100, end_tick: 400 }],
    });
    expect(nadeVisibleEnd(g, 64)).toBe(400);
  });

  it("does not extend past the default window if occupancy lingered in GOTV", () => {
    const g = molotov({
      end_tick: 50_000,
      fires: [{ x: 0, y: 0, start_tick: 100, end_tick: 50_000 }],
    });
    expect(nadeVisibleEnd(g, 64)).toBe(100 + 64 * 7);
  });

  it("clips to round end", () => {
    const g = smoke();
    expect(nadeVisibleEnd(g, 64, 200)).toBe(200);
  });
});

describe("nadePopTick", () => {
  it("uses the first occupancy sample when detonate is late", () => {
    const g = molotov({
      detonate_tick: 50_000,
      fires: [{ x: 0, y: 0, start_tick: 120, end_tick: 400 }],
    });
    expect(nadePopTick(g)).toBe(120);
  });
});

describe("nadeLandPos", () => {
  it("uses the last trajectory point when there is no occupancy", () => {
    const g = smoke({
      points: [
        { tick: 80, x: 0, y: 0, z: 0 },
        { tick: 100, x: 400, y: 200, z: 10 },
      ],
    });
    expect(nadeLandPos(g)).toEqual({ x: 400, y: 200 });
  });

  it("uses the occupancy centroid at pop", () => {
    const g = molotov({
      fires: [
        { x: 0, y: 0, start_tick: 100, end_tick: 200 },
        { x: 20, y: 40, start_tick: 100, end_tick: 200 },
        { x: 999, y: 999, start_tick: 201, end_tick: 300 },
      ],
    });
    expect(nadeLandPos(g)).toEqual({ x: 10, y: 20 });
  });

  it("returns null with no points and no occupancy", () => {
    expect(nadeLandPos(smoke())).toBeNull();
  });
});

describe("nadesForSummary", () => {
  it("drops knife-round nades and draws smokes under flashes", () => {
    const flash = makeGrenade({
      kind: "flash",
      start_tick: 200,
      detonate_tick: 220,
      end_tick: 240,
      points: [{ tick: 220, x: 1, y: 1, z: 0 }],
    });
    const knifeSmoke = smoke({ start_tick: 10, detonate_tick: 20 });
    const liveSmoke = smoke({ start_tick: 200, detonate_tick: 220 });
    const m = makeReplay({
      rounds: [
        makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
        makeRound({ number: 1, start_tick: 100, freeze_end_tick: 164, end_tick: 640 }),
      ],
      grenades: [flash, knifeSmoke, liveSmoke],
    });
    expect(nadesForSummary(m).map((g) => g.kind)).toEqual(["smoke", "flash"]);
  });

  it("filters summary nades by kind and thrower side", () => {
    const tSmoke = smoke({ thrower: 1, start_tick: 200, detonate_tick: 220 });
    const ctFlash = makeGrenade({
      kind: "flash",
      start_tick: 200,
      detonate_tick: 220,
      end_tick: 240,
      points: [{ tick: 220, x: 1, y: 1, z: 0 }],
    });
    const m = makeReplay({
      grenades: [tSmoke, ctFlash],
    });
    expect(
      nadesForSummary(m, {
        ...DEFAULT_SUMMARY_FILTER,
        kinds: { ...DEFAULT_SUMMARY_FILTER.kinds, flash: false },
      }).map((g) => g.kind),
    ).toEqual(["smoke"]);
    expect(nadesForSummary(m, { ...DEFAULT_SUMMARY_FILTER, t: false }).map((g) => g.kind)).toEqual([
      "flash",
    ]);
    expect(nadesForSummary(m, { ...DEFAULT_SUMMARY_FILTER, ct: false }).map((g) => g.kind)).toEqual(
      ["smoke"],
    );
  });
});

describe("killLineEnds", () => {
  it("draws attacker to victim for an enemy frag", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.x[0] = 0;
    ticks.y[0] = 0;
    ticks.x[1] = 200;
    ticks.y[1] = 0;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({ ticks });
    const line = killLineEnds(m, makeKill(100, 0, 1, { x: 200 }));
    expect(line).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 200, y: 0 },
      ct: true,
    });
  });

  it("skips suicides, teamkills, and point-blank overlap", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.x[0] = 0;
    ticks.x[1] = 8;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    const m = makeReplay({ ticks });
    expect(killLineEnds(m, makeKill(100, 0, 0))).toBeNull();
    expect(killLineEnds(m, makeKill(100, 0, 1, { x: 8 }))).toBeNull();
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.x[1] = KILL_LINE_MIN_LENGTH - 1;
    expect(killLineEnds(m, makeKill(100, 0, 1, { x: KILL_LINE_MIN_LENGTH - 1 }))).toBeNull();
  });
});

describe("openingDuel", () => {
  it("is the first enemy kill of the round, not a teamkill", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      kills: [makeKill(80, 0, 2, { x: 10 }), makeKill(120, 0, 1, { x: 200 }), makeKill(180, 1, 0)],
    });
    const r = m.rounds[0];
    expect(openingDuel(m, r, 110)).toBeNull();
    expect(openingDuel(m, r, 120)?.attacker).toBe(0);
    expect(openingDuel(m, r, 120)?.victim).toBe(1);
    expect(openingDuel(m, r, 640)?.tick).toBe(120);
  });
});

describe("shortenSegment", () => {
  it("caps length and leaves short segments", () => {
    expect(shortenSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 40)).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 40, y: 0 },
    });
    expect(shortenSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 40)).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 },
    });
  });
});
