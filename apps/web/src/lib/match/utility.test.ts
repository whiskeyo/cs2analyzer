import { describe, expect, it } from "vitest";
import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import type { GrenadeKind, GrenadeThrow, Replay } from "@/lib/replay/replayTypes";
import {
  makeBlind,
  makeCallout,
  makeGrenade,
  makeHurt,
  makePlaces,
  makePlayer,
  makeReplay,
  type ReplayOverrides,
} from "@/lib/testing/fixtures";
import {
  throwDetail,
  usedUtilKinds,
  usedUtilPlaces,
  utilKindSummary,
  utilMatchesCallout,
  utilMatchesPlace,
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
    expect(throwDetail(u.throws[0]!)).toMatch(/Bob/);
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
        },
      ],
      grenades: [
        nade("smoke", 100, 0),
        nade("flash", 800, 1),
        nade("he", 850, 1),
      ],
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
