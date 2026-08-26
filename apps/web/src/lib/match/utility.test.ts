import { describe, expect, it } from "vitest";
import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import type { LayoutCallout } from "@/lib/radar/layouts";
import type { GrenadeKind, GrenadeThrow, Player, Replay, Round } from "@/lib/replay/replayTypes";
import type { MapPlaces } from "./sites";
import {
  throwDetail,
  usedUtilCallouts,
  usedUtilKinds,
  utilKindSummary,
  utilMatchesCallout,
  utilityThrough,
} from "./utility";

function player(index: number, side: Player["start_side"], name: string): Player {
  return { index, steam_id: index + 1, name, start_side: side };
}

function round(partial: Partial<Round> & Pick<Round, "number">): Round {
  return {
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 640,
    winner: "CT",
    win_reason: 8,
    score_ct: 0,
    score_t: 0,
    is_knife: false,
    ...partial,
  };
}

function emptyTicks() {
  return {
    frameCount: 0,
    playerCount: 0,
    ticks: new Uint32Array(),
    x: new Float32Array(),
    y: new Float32Array(),
    z: new Float32Array(),
    yaw: new Float32Array(),
    health: new Uint8Array(),
    armor: new Uint8Array(),
    flags: new Uint8Array(),
    money: new Uint16Array(),
    equip: new Uint16Array(),
    gear: new Uint16Array(),
    primary: new Uint8Array(),
    secondary: new Uint8Array(),
  };
}

function replay(partial: Partial<Replay> = {}): Replay {
  return {
    header: {
      map_name: "de_anubis",
      tick_rate: 64,
      tick_stride: 4,
      duration_s: 10,
      playback_ticks: 1920,
      team_ct: "CT",
      team_t: "T",
      score_ct: 0,
      score_t: 0,
    },
    players: [player(0, "CT", "Alice"), player(1, "T", "Bob"), player(2, "T", "Dave")],
    rounds: [round({ number: 1 })],
    grenades: [],
    shots: [],
    kills: [],
    hurts: [],
    blinds: [],
    bombEvents: [],
    stats: [],
    ticks: emptyTicks(),
    ...partial,
  };
}

function nade(
  kind: GrenadeKind,
  tick: number,
  thrower: number,
  x?: number,
  y?: number,
): GrenadeThrow {
  return {
    thrower,
    kind,
    start_tick: tick,
    detonate_tick: tick + 20,
    end_tick: tick + 80,
    points: x == null || y == null ? [] : [{ tick: tick + 20, x, y, z: 0 }],
  };
}

function rect(id: string, name: string, x: number, y: number, w: number, h: number): LayoutCallout {
  return {
    id,
    name,
    floor: "default",
    polygon: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}

const layoutPlaces: MapPlaces = {
  layout: {
    schema: 1,
    map: "de_test",
    callouts: [
      rect("a", "A Site", 0, 0, 100, 100),
      rect("b", "B Site", 800, 800, 100, 100),
      rect("mid", "Mid", 400, 400, 100, 100),
    ],
  },
  cal: { pos_x: 0, pos_y: 1024, scale: 1, radar: "test.png" },
};

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
        { tick: 110, attacker: 0, victim: 1, duration: MIN_REVIEW_FLASH_SECONDS },
        { tick: 112, attacker: 0, victim: 1, duration: MIN_REVIEW_FLASH_SECONDS - 0.05 },
        { tick: 114, attacker: 0, victim: 0, duration: 1.2 },
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
        { tick: 100, attacker: 0, victim: 1, damage: 13, weapon: "hegrenade" },
        { tick: 104, attacker: 0, victim: 2, damage: 55, weapon: "hegrenade" },
        { tick: 110, attacker: 0, victim: 0, damage: 20, weapon: "hegrenade" },
        { tick: 120, attacker: 0, victim: 1, damage: 40, weapon: "ak47" },
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
      hurts: [{ tick: 100, attacker: 0, victim: 1, damage: 22, weapon: "inferno" }],
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
    expect(usedUtilCallouts(u.throws, layoutPlaces.layout)).toEqual(["A Site", "Mid"]);
    expect(u.throws.filter((row) => utilMatchesCallout(row, "A Site"))).toHaveLength(1);
    expect(u.throws.filter((row) => utilMatchesCallout(row, "B Site"))).toHaveLength(0);
    expect(usedUtilKinds(u.throws)).toEqual(["smoke", "flash"]);
  });
});
