import { describe, expect, it } from "vitest";
import { FLASH_FULL_SECONDS, MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_PRESENT,
  type GrenadeKind,
  type GrenadeThrow,
  type Replay,
} from "@/lib/replay/replayTypes";
import {
  makeBlind,
  makeCallout,
  makeGrenade,
  makeHurt,
  makePlaces,
  makePlayer,
  makeReplay,
  makeTicks,
  type ReplayOverrides,
} from "@/lib/testing/fixtures";
import {
  pickFlashDuration,
  throwDetail,
  usedUtilKinds,
  usedUtilPlaces,
  utilKindSelected,
  utilKindSummary,
  utilMatchesCallout,
  utilMatchesPlace,
  utilRowTone,
  utilThrowsForRound,
  utilityThrough,
} from "./utility";

/** Named roster: the util tab reports victims by name. */
function replay(overrides: ReplayOverrides = {}): Replay {
  return makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob"), makePlayer(2, "T", "Dave")],
    ...overrides,
  });
}

/** Throw at `tick` that detonates 20 ticks later, optionally landing at (x, y). */
function nade(
  kind: GrenadeKind,
  tick: number,
  thrower: number,
  x?: number,
  y?: number,
): GrenadeThrow {
  return makeGrenade({
    thrower,
    kind,
    start_tick: tick,
    detonate_tick: tick + 20,
    end_tick: tick + 80,
    points: x == null || y == null ? [] : [{ tick: tick + 20, x, y, z: 0 }],
  });
}

const layoutPlaces = makePlaces([
  makeCallout("a", "A Site", 0, 0, 100, 100),
  makeCallout("b", "B Site", 800, 800, 100, 100),
  makeCallout("mid", "Mid", 400, 400, 100, 100),
]);

describe("utilityThrough", () => {
  it("lists nades in throw order and keeps a kind summary", () => {
    const m = replay({
      grenades: [
        nade("smoke", 300, 1),
        nade("flash", 100, 0),
        nade("he", 200, 0),
        nade("molotov", 250, 1),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws.map((row) => row.kind)).toEqual(["flash", "he", "molotov", "smoke"]);
    expect(utilKindSummary(u.byKind)).toBe("1 Smoke · 1 Flash · 1 HE · 1 Molly");
  });

  it("counts molotov and incendiary as one Molly chip/summary entry", () => {
    const m = replay({
      grenades: [nade("molotov", 100, 0), nade("incendiary", 200, 1)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws.map((row) => row.kind)).toEqual(["molotov", "incendiary"]);
    expect(utilKindSummary(u.byKind)).toBe("2 Molly");
    expect(usedUtilKinds(u.throws)).toEqual(["molotov"]);
    expect(utilKindSelected(["molotov"], "incendiary")).toBe(true);
    expect(utilKindSelected(["molotov"], "smoke")).toBe(false);
  });

  it("attaches blinds that actually land and drops pop-flashes", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0, 50, 974)],
      blinds: [
        makeBlind(110, 0, 1, MIN_REVIEW_FLASH_SECONDS),
        makeBlind(112, 0, 1, MIN_REVIEW_FLASH_SECONDS - 0.05),
        makeBlind(114, 0, 0, 1.2),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws).toHaveLength(1);
    expect(u.throws[0]?.blinds).toHaveLength(2);
    expect(u.enemyFlashCount).toBe(1);
    expect(u.throws[0]?.blinds[0]?.victimName).toBe("Bob");
    expect(throwDetail(u.throws[0]!)).toBe("Enemy: Bob 0.4s · Team: Alice 1.2s");
    expect(utilRowTone(u.throws[0]!)).toBe("mixed");
  });

  it("keeps one blind per victim and the longest duration", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0, 50, 974)],
      blinds: [
        makeBlind(110, 0, 1, 0.9),
        makeBlind(111, 0, 1, 0.9),
        makeBlind(112, 0, 1, 0.8),
        makeBlind(113, 0, 1, 1.4),
        makeBlind(114, 0, 1, 0.9),
        makeBlind(115, -1, 1, 0.6),
        makeBlind(120, 0, 0, 0.5),
        makeBlind(121, 0, 0, 0.5),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 1.4, enemy: true },
      { victim: 0, victimName: "Alice", duration: 0.5, enemy: false },
    ]);
    expect(u.enemyFlashCount).toBe(1);
    expect(throwDetail(u.throws[0]!)).toBe("Enemy: Bob 1.4s · Team: Alice 0.5s");
  });

  it("ignores full-overlay pawn snaps when a weaker player_blind exists", () => {
    expect(pickFlashDuration([1.2, FLASH_FULL_SECONDS, 5.1])).toBeCloseTo(1.2);
    expect(pickFlashDuration([0.2, 5.1])).toBeCloseTo(0.2);
    expect(pickFlashDuration([5.1, FLASH_FULL_SECONDS]), "overlay-only samples are not chips").toBe(
      0,
    );
    const m = replay({
      grenades: [nade("flash", 90, 0)],
      blinds: [
        makeBlind(110, 0, 0, 5.1),
        makeBlind(111, 0, 0, 1.2),
        makeBlind(112, 0, 1, FLASH_FULL_SECONDS),
        makeBlind(113, 0, 1, 0.2),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 0, victimName: "Alice", duration: 1.2, enemy: false },
      { victim: 1, victimName: "Bob", duration: 0.2, enemy: true },
    ]);
    expect(throwDetail(u.throws[0]!)).toBe("Enemy: Bob 0.2s · Team: Alice 1.2s");
  });

  it("does not list overlay-only snaps as Utility chips", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0)],
      blinds: [makeBlind(110, 0, 0, 5.1), makeBlind(112, 0, 1, FLASH_FULL_SECONDS)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds, "overlay-only samples are not chips").toEqual([]);
    expect(throwDetail(u.throws[0]!)).toBe("");
  });

  it("lists a player_blind that lands a few ticks before detonate", () => {
    // nade("flash", 90) detonates at 110. Revert flashWindowHas slack → empty chips.
    const m = replay({
      grenades: [nade("flash", 90, 0)],
      blinds: [makeBlind(108, 0, 1, 1.4), makeBlind(109, 0, 0, 0.6)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds, "pre-detonate player_blind must attach").toEqual([
      { victim: 1, victimName: "Bob", duration: 1.4, enemy: true },
      { victim: 0, victimName: "Alice", duration: 0.6, enemy: false },
    ]);
  });

  it("keeps the first pop's blinds when a second flash lands before they expire", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0), nade("flash", 200, 1)],
      blinds: [
        makeBlind(110, 0, 2, 3.0),
        makeBlind(115, 0, 2, 2.8),
        makeBlind(222, 0, 2, 2.4),
        makeBlind(222, 1, 2, 5.1),
        makeBlind(225, 1, 2, 3.4),
        makeBlind(226, 1, 0, 2.1),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.kind).toBe("flash");
    expect(u.throws[1]?.kind).toBe("flash");
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 2, victimName: "Dave", duration: 3.0, enemy: true },
    ]);
    expect(u.throws[1]?.blinds).toEqual([
      { victim: 0, victimName: "Alice", duration: 2.1, enemy: true },
    ]);
  });

  it("does not chip yazuyy leftover on Matt's Cave throw", () => {
    // Elbow leftover still yellow on yazuyy when Matt's Cave pops. Revert
    // isFreshOnset leftover isolation → yazuyy appears on throw B chips.
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Mattiii208"),
        makePlayer(2, "T", "yazuyy"),
      ],
      grenades: [nade("flash", 90, 2), nade("flash", 160, 1)],
      blinds: [
        makeBlind(110, 2, 2, 1.3),
        makeBlind(182, 1, 2, 5.1),
        makeBlind(183, 1, 2, 4.1),
        makeBlind(184, 1, 1, 1.6),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.throwerName).toBe("yazuyy");
    expect(u.throws[1]?.throwerName).toBe("Mattiii208");
    expect(u.throws[0]?.blinds.map((b) => b.victimName)).toEqual(["yazuyy"]);
    expect(
      u.throws[1]?.blinds.map((b) => b.victimName),
      "leftover from throw A must not chip on throw B",
    ).toEqual(["Mattiii208"]);
  });

  it("does not put a teammate leftover / overlay on the later throw (R21 Cave)", () => {
    // Dave · Elbow, then Bob · Cave. Dave's 4.1s radar leftover / 5.1 overlay
    // re-snap is still Elbow — even when attacker is rewritten to Bob.
    const m = replay({
      grenades: [nade("flash", 90, 2), nade("flash", 160, 1)],
      blinds: [
        makeBlind(110, 2, 2, 1.3),
        makeBlind(110, 2, 1, 0.5),
        makeBlind(111, 2, 2, 5.1),
        makeBlind(111, 2, 1, 5.1),
        makeBlind(182, 1, 2, 5.1),
        makeBlind(182, 1, 1, 5.1),
        makeBlind(183, 1, 2, 4.1),
        makeBlind(184, 1, 1, 1.6),
        makeBlind(185, 1, 0, 1.1),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.throwerName).toBe("Dave");
    expect(u.throws[1]?.throwerName).toBe("Bob");
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 0.5, enemy: false },
      { victim: 2, victimName: "Dave", duration: 1.3, enemy: false },
    ]);
    expect(u.throws[1]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 1.6, enemy: false },
      { victim: 0, victimName: "Alice", duration: 1.1, enemy: true },
    ]);
  });

  it("does not chip a Cave self-blind that is only an overlay snap after Elbow", () => {
    const m = replay({
      grenades: [nade("flash", 90, 2), nade("flash", 160, 1)],
      blinds: [makeBlind(110, 2, 1, 0.5), makeBlind(182, 1, 1, 5.1)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 0.5, enemy: false },
    ]);
    expect(u.throws[1]?.blinds).toEqual([]);
  });

  it("moves a victim to the later throw only after the first peak expires", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0), nade("flash", 400, 1)],
      blinds: [makeBlind(110, 0, 2, 0.4), makeBlind(420, 1, 2, 2.1)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 2, victimName: "Dave", duration: 0.4, enemy: true },
    ]);
    expect(u.throws[1]?.blinds).toEqual([
      { victim: 2, victimName: "Dave", duration: 2.1, enemy: false },
    ]);
  });

  it("still lists a first onset when attacker is a stale last_flash_thrower", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0)],
      blinds: [makeBlind(110, 1, 1, 1.2), makeBlind(111, 1, 0, 0.8)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 1.2, enemy: true },
      { victim: 0, victimName: "Alice", duration: 0.8, enemy: false },
    ]);
  });

  it("does not list an unmapped victim (bot / steam_id 0 → index -1)", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0)],
      blinds: [makeBlind(110, 0, -1, 1.8), makeBlind(111, 0, 1, 1.2)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 1.2, enemy: true },
    ]);
  });

  it("only lists players who were alive at the flash, not leftover dead-pawn blinds", () => {
    const ticks = makeTicks(3, 1);
    ticks.ticks[0] = 110;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[2] = FLAG_PRESENT;
    const m = replay({
      grenades: [nade("flash", 90, 0)],
      blinds: [makeBlind(110, 0, 1, 1.2), makeBlind(110, 0, 2, 1.5), makeBlind(112, 0, 0, 0.8)],
      ticks,
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 1.2, enemy: true },
      { victim: 0, victimName: "Alice", duration: 0.8, enemy: false },
    ]);
    expect(u.enemyFlashCount).toBe(1);
  });

  it("does not attach an earlier flash's leftover samples to a later throw", () => {
    const ticks = makeTicks(3, 2);
    ticks.ticks[0] = 110;
    ticks.ticks[1] = 420;
    for (const frame of [0, 1]) {
      ticks.flags[frame * 3 + 0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      ticks.flags[frame * 3 + 1] = FLAG_PRESENT | FLAG_ALIVE;
      ticks.flags[frame * 3 + 2] = frame === 0 ? FLAG_PRESENT | FLAG_ALIVE : FLAG_PRESENT;
    }
    const m = replay({
      grenades: [nade("flash", 90, 0), nade("flash", 400, 0)],
      blinds: [
        makeBlind(110, 0, 1, 1.2),
        makeBlind(110, 0, 2, 1.4),
        makeBlind(380, 0, 2, 0.9),
        makeBlind(420, 0, 1, 0.8),
        makeBlind(420, 0, 2, 0.9),
      ],
      ticks,
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds.map((blind) => blind.victimName)).toEqual(["Bob", "Dave"]);
    expect(u.throws[1]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 0.8, enemy: true },
    ]);
  });

  it("colours flashes by who was blinded, not by site", () => {
    const m = replay({
      grenades: [
        nade("flash", 90, 0, 50, 974),
        nade("flash", 200, 0, 50, 974),
        nade("flash", 300, 0, 50, 974),
        nade("flash", 400, 0, 50, 974),
      ],
      blinds: [
        makeBlind(220, 0, 1, 1.2),
        makeBlind(320, 0, 2, 0.8),
        makeBlind(322, 0, 0, 1.1),
        makeBlind(420, 0, 0, 1.4),
      ],
    });
    const u = utilityThrough(m, 640, null, layoutPlaces);
    expect(u.throws[0]?.inSite).toBe(true);
    expect(utilRowTone(u.throws[0]!)).toBe("");
    expect(throwDetail(u.throws[0]!)).toBe("");
    expect(utilRowTone(u.throws[1]!)).toBe("good");
    expect(throwDetail(u.throws[1]!)).toBe("Bob 1.2s");
    expect(utilRowTone(u.throws[2]!)).toBe("mixed");
    expect(throwDetail(u.throws[2]!)).toBe("Enemy: Dave 0.8s · Team: Alice 1.1s");
    expect(utilRowTone(u.throws[3]!)).toBe("high");
    expect(throwDetail(u.throws[3]!)).toBe("Alice 1.4s");
  });

  it("lists who an HE actually hit", () => {
    const m = replay({
      grenades: [nade("he", 80, 0, 50, 974)],
      hurts: [
        makeHurt(100, 0, 1, 13, { weapon: "hegrenade" }),
        makeHurt(104, 0, 2, 55, { weapon: "hegrenade" }),
        makeHurt(110, 0, 0, 20, { weapon: "hegrenade" }),
        makeHurt(120, 0, 1, 40),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.heDamage).toBe(68);
    expect(u.throws[0]?.hits.map((hit) => `${hit.victimName} (${hit.damage})`)).toEqual([
      "Bob (13)",
      "Dave (55)",
    ]);
    expect(throwDetail(u.throws[0]!)).toBe("Bob (13), Dave (55)");
  });

  it("attaches molly fire to the throw", () => {
    const m = replay({
      grenades: [nade("molotov", 80, 0, 50, 974)],
      hurts: [makeHurt(100, 0, 1, 22, { weapon: "inferno" })],
    });
    const u = utilityThrough(m, 640, null);
    expect(throwDetail(u.throws[0]!)).toBe("Bob (22)");
  });

  it("attaches blinds after the flash pop end_tick and with an unknown attacker", () => {
    const m = replay({
      grenades: [nade("flash", 90, 0, 50, 974)],
      blinds: [makeBlind(200, -1, 1, 1.8)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.blinds).toEqual([
      { victim: 1, victimName: "Bob", duration: 1.8, enemy: true },
    ]);
    expect(throwDetail(u.throws[0]!)).toBe("Bob 1.8s");
  });

  it("keeps molly burns that land after a short projectile end_tick", () => {
    const m = replay({
      grenades: [nade("molotov", 80, 0, 50, 974)],
      hurts: [
        makeHurt(300, 0, 1, 18, { weapon: "inferno" }),
        makeHurt(310, 0, 2, 9, { weapon: "incendiarygrenade" }),
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.throws[0]?.endTick).toBe(160);
    expect(throwDetail(u.throws[0]!)).toBe("Bob (18), Dave (9)");
    expect(utilRowTone(u.throws[0]!)).toBe("good");
  });

  it("labels landings and counts A/B only when a layout exists", () => {
    const m = replay({
      grenades: [
        nade("smoke", 200, 1, 50, 974),
        nade("flash", 210, 0, 850, 174),
        nade("he", 220, 1, 450, 574),
      ],
    });
    const unlabeled = utilityThrough(m, 640, null);
    expect(unlabeled.throws).toHaveLength(3);
    expect(unlabeled.inSite).toBe(0);
    expect(unlabeled.throws.every((row) => row.location == null && row.site == null)).toBe(true);

    const u = utilityThrough(m, 640, null, layoutPlaces);
    expect(u.inSite).toBe(2);
    expect(u.nadesA).toBe(1);
    expect(u.nadesB).toBe(1);
    expect(u.throws.every((row) => utilRowTone(row) === "")).toBe(true);
    expect(u.throws[0]?.location).toBe("A Site");
    expect(u.throws[1]?.location).toBe("B Site");
    const onlyBob = utilityThrough(m, 640, 1, layoutPlaces);
    expect(onlyBob.throws).toHaveLength(2);
    expect(onlyBob.inSite).toBe(1);
  });

  it("lists only callouts that nades actually used", () => {
    const m = replay({
      grenades: [nade("smoke", 200, 1, 50, 974), nade("flash", 240, 0, 450, 574)],
    });
    const u = utilityThrough(m, 640, null, layoutPlaces);
    expect(usedUtilPlaces(u.throws, layoutPlaces.layout).map((chip) => chip.label)).toEqual([
      "A Site",
      "Mid",
    ]);
    expect(u.throws.filter((row) => utilMatchesCallout(row, "A Site"))).toHaveLength(1);
    expect(u.throws.filter((row) => utilMatchesCallout(row, "B Site"))).toHaveLength(0);
    expect(usedUtilKinds(u.throws)).toEqual(["smoke", "flash"]);
  });

  it("exposes a used group as one filter chip covering its members", () => {
    const grouped = makePlaces([
      makeCallout("mid", "Mid", 400, 400, 100, 100),
      { ...makeCallout("a", "A Site", 0, 0, 100, 100), group: "A side" },
      { ...makeCallout("tet", "Tetris", 150, 150, 100, 100), group: "A side" },
    ]);
    const m = replay({
      grenades: [
        nade("smoke", 200, 1, 50, 974),
        nade("flash", 210, 0, 200, 824),
        nade("he", 220, 1, 450, 574),
      ],
    });
    const u = utilityThrough(m, 640, null, grouped);
    const chips = usedUtilPlaces(u.throws, grouped.layout);
    expect(chips.map((chip) => chip.label)).toEqual(["A side", "Mid"]);
    const aSide = chips[0];
    expect(aSide).toBeDefined();
    expect(u.throws.filter((row) => utilMatchesPlace(row, aSide!))).toHaveLength(2);
  });
});

describe("utilThrowsForRound", () => {
  it("matches utilityThrough for a full round", () => {
    const m = replay({
      rounds: [
        {
          number: 1,
          team_ct: "CT",
          team_t: "T",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          winner: "CT",
          win_reason: 0,
          is_knife: false,
          score_ct: 1,
          score_t: 0,
        },
        {
          number: 2,
          team_ct: "CT",
          team_t: "T",
          start_tick: 700,
          freeze_end_tick: 764,
          end_tick: 1400,
          winner: "T",
          win_reason: 0,
          is_knife: false,
          score_ct: 1,
          score_t: 1,
        },
      ],
      grenades: [nade("smoke", 100, 0), nade("flash", 800, 1), nade("he", 850, 1)],
      blinds: [makeBlind(820, 1, 0, MIN_REVIEW_FLASH_SECONDS)],
    });
    const round1 = utilThrowsForRound(m, 1, null);
    const round2 = utilThrowsForRound(m, 2, null);
    expect(round1.map((row) => row.kind)).toEqual(["smoke"]);
    expect(round2.map((row) => row.kind)).toEqual(["flash", "he"]);
    expect(round2[0]?.blinds).toHaveLength(1);

    const throughRound1 = utilityThrough(m, 640, null).throws.filter((row) => row.round === 1);
    expect(round1.map((row) => row.tick)).toEqual(throughRound1.map((row) => row.tick));
  });
});
