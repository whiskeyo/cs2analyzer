import { describe, expect, it } from "vitest";
import {
  FLASH_FULL_SECONDS,
  HE_BURST_SECONDS,
  KILL_LINE_MIN_LENGTH,
  SMOKE_FADE_SECONDS,
  SMOKE_SECONDS,
} from "@/lib/shared/constants";
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
  smokeOpacity,
} from "./radarFx";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type GrenadeThrow } from "@/lib/replay/replayTypes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import {
  makeGrenade,
  makeHurt,
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

  it("does not let a 5.1s overlay snap hide a shorter player_blind", () => {
    // Revert blindsAt overlay skip → victim 0 paints 5.47s and victim 1 paints 5.1s.
    const blinds = [
      { tick: 100, attacker: 1, victim: 0, duration: 1.3 },
      { tick: 100, attacker: 1, victim: 0, duration: FLASH_FULL_SECONDS },
      { tick: 100, attacker: 1, victim: 1, duration: 5.1 },
    ];
    expect(blindsAt(blinds, 100, 64).get(0), "prefer short player_blind over overlay").toBeCloseTo(
      1.3,
      5,
    );
    expect(blindsAt(blinds, 100, 64).get(1), "overlay-band must not paint").toBeUndefined();
  });

  it("does not paint overlay-only 5.0s yellow on a far pawn", () => {
    // Twin Matt + yazuyy yellow: two overlay-only victims. Revert → size === 2.
    const blinds = [
      { tick: 100, attacker: 1, victim: 0, duration: 5.0 },
      { tick: 100, attacker: 1, victim: 1, duration: 5.0 },
    ];
    expect(blindsAt(blinds, 100, 64).size, "overlay-band must not paint").toBe(0);
  });

  it("does not paint 4.95s leftover that labels as 5.0s", () => {
    const blinds = [{ tick: 100, attacker: 1, victim: 0, duration: 4.95 }];
    expect(blindsAt(blinds, 100, 64).size, "overlay-band must not paint").toBe(0);
    expect(formatBlindLeft(4.95)).toBe("5.0s");
  });

  it("formats remaining flash time for the radar label", () => {
    expect(formatBlindLeft(1.42)).toBe("1.4s");
    expect(formatBlindLeft(0.05)).toBe("0.1s");
  });
});

describe("hitsAt", () => {
  it("tracks the latest hit inside the pulse window", () => {
    const hurts = [makeHurt(50, 1, 0, 20), makeHurt(100, 1, 0, 40)];
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
  it("uses the parser end_tick for a smoke, including past round end", () => {
    const end = 100 + 64 * 22;
    const g = smoke({ end_tick: end });
    expect(nadeVisibleEnd(g, 64, 200)).toBe(end);
    const stretched = smoke({ end_tick: 50_000 });
    expect(nadeVisibleEnd(stretched, 64, 200)).toBe(50_000);
    const early = smoke({ end_tick: 100 + 64 * 2 });
    expect(nadeVisibleEnd(early, 64, 200)).toBe(100 + 64 * 2);
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

  it("leaves a fire burning past round end and still clips a flash", () => {
    const fire = molotov({
      detonate_tick: 100,
      end_tick: 450,
      fires: [{ x: 0, y: 0, start_tick: 100, end_tick: 450 }],
    });
    expect(nadeVisibleEnd(fire, 64, 200)).toBe(450);
    const flash = makeGrenade({
      kind: "flash",
      detonate_tick: 100,
      end_tick: 400,
      points: [{ tick: 100, x: 1, y: 1, z: 0 }],
    });
    expect(nadeVisibleEnd(flash, 64, 110)).toBe(110);
  });
});

describe("smokeOpacity", () => {
  const pop = 100;
  const end = pop + 64 * 22;

  it("stays solid until the last 4s", () => {
    expect(smokeOpacity(end, pop, 64)).toBe(1);
    expect(smokeOpacity(end, pop + 64 * (SMOKE_SECONDS / 2), 64)).toBe(1);
    expect(smokeOpacity(end, end - 64 * SMOKE_FADE_SECONDS, 64)).toBe(1);
  });

  it("is about 0.5 two seconds before the end and 0 from visibleEnd", () => {
    expect(smokeOpacity(end, end - 64 * 2, 64)).toBeCloseTo(0.5, 5);
    expect(smokeOpacity(end, end, 64)).toBe(0);
    expect(smokeOpacity(end, end + 1, 64)).toBe(0);
  });

  it("scales the fade with the tick rate instead of a hardcoded 64", () => {
    const rate = 128;
    const fastEnd = pop + rate * 22;
    expect(smokeOpacity(fastEnd, fastEnd - rate * 2, rate)).toBeCloseTo(0.5, 5);
    expect(smokeOpacity(fastEnd, fastEnd - rate * SMOKE_FADE_SECONDS, rate)).toBe(1);
  });

  it("starts a smoke shorter than 4s below 1 and never exceeds 1", () => {
    const shortEnd = pop + 64 * 2;
    expect(nadeVisibleEnd(smoke({ end_tick: shortEnd }), 64, 200)).toBe(shortEnd);
    const atPop = smokeOpacity(shortEnd, pop, 64);
    const mid = smokeOpacity(shortEnd, pop + 64, 64);
    expect(atPop).toBeCloseTo(0.5, 5);
    expect(mid).toBeCloseTo(0.25, 5);
    expect(atPop).toBeLessThanOrEqual(1);
    expect(mid).toBeLessThanOrEqual(1);
    expect(smokeOpacity(shortEnd, shortEnd, 64)).toBe(0);
  });

  it("stays at 1 at playback end when the smoke lasts at least 4s past it", () => {
    const playbackEnd = 1_000;
    const end = playbackEnd + 64 * SMOKE_FADE_SECONDS;
    const g = smoke({ detonate_tick: 100, end_tick: end });
    const visibleEnd = nadeVisibleEnd(g, 64, 400);
    expect(visibleEnd).toBe(end);
    expect(smokeOpacity(visibleEnd, playbackEnd, 64)).toBe(1);
    const later = playbackEnd + 64 * (SMOKE_FADE_SECONDS + 1);
    expect(smokeOpacity(later, playbackEnd, 64)).toBe(1);
  });

  it("is about half faded at playback end when the smoke ends 2s later", () => {
    const playbackEnd = 1_000;
    const end = playbackEnd + 64 * 2;
    const g = smoke({ detonate_tick: 100, end_tick: end });
    const visibleEnd = nadeVisibleEnd(g, 64, 400);
    expect(visibleEnd).toBe(end);
    expect(visibleEnd).toBeGreaterThan(playbackEnd);
    expect(smokeOpacity(visibleEnd, playbackEnd, 64)).toBeCloseTo(0.5, 5);
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

  it("filters molotov and incendiary together under the Molly control", () => {
    const m = makeReplay({
      grenades: [
        makeGrenade({ kind: "molotov", start_tick: 200, detonate_tick: 220, end_tick: 240 }),
        makeGrenade({ kind: "incendiary", start_tick: 200, detonate_tick: 220, end_tick: 240 }),
      ],
    });
    expect(
      nadesForSummary(m, {
        ...DEFAULT_SUMMARY_FILTER,
        kinds: { ...DEFAULT_SUMMARY_FILTER.kinds, molotov: false, incendiary: false },
      }).map((g) => g.kind),
    ).toEqual([]);
    expect(
      nadesForSummary(m, {
        ...DEFAULT_SUMMARY_FILTER,
        kinds: { ...DEFAULT_SUMMARY_FILTER.kinds, molotov: true, incendiary: false },
      }).map((g) => g.kind),
    ).toEqual(["molotov", "incendiary"]);
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

  it("prefers stored attacker xyz over the tick sample", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.x[0] = 0;
    ticks.y[0] = 0;
    ticks.x[1] = 200;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({ ticks });
    const line = killLineEnds(m, makeKill(100, 0, 1, { x: 200, attacker_x: 50, attacker_y: 10 }));
    expect(line).toEqual({
      from: { x: 50, y: 10 },
      to: { x: 200, y: 0 },
      ct: true,
    });
  });

  it("uses stored attacker xyz when the tick sample is missing", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    });
    const line = killLineEnds(
      m,
      makeKill(100, 0, 1, { x: 200, attacker_x: 0, attacker_y: 40, attacker_z: 1 }),
    );
    expect(line).toEqual({
      from: { x: 0, y: 40 },
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
