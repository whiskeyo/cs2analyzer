import { describe, expect, it } from "vitest";
import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import type { GrenadeThrow, Player, Replay, Round } from "@/lib/replay/replayTypes";
import { utilityThrough } from "./utility";

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
    players: [player(0, "CT", "Alice"), player(1, "T", "Bob")],
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

function smoke(x: number, y: number, thrower = 1): GrenadeThrow {
  return {
    thrower,
    kind: "smoke",
    start_tick: 200,
    detonate_tick: 220,
    end_tick: 220 + 64 * 18,
    points: [{ tick: 220, x, y, z: 0 }],
  };
}

describe("utilityThrough", () => {
  it("keeps flashes that actually blind and drops pop-flashes", () => {
    const m = replay({
      blinds: [
        { tick: 100, attacker: 0, victim: 1, duration: MIN_REVIEW_FLASH_SECONDS },
        { tick: 120, attacker: 0, victim: 1, duration: MIN_REVIEW_FLASH_SECONDS - 0.05 },
        { tick: 140, attacker: 0, victim: 0, duration: 1.2 },
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.flashes).toHaveLength(2);
    expect(u.enemyFlashCount).toBe(1);
    expect(u.flashes[0]?.victimName).toBe("Bob");
  });

  it("sums enemy HE damage", () => {
    const m = replay({
      hurts: [
        { tick: 100, attacker: 0, victim: 1, damage: 57, weapon: "hegrenade" },
        { tick: 110, attacker: 0, victim: 0, damage: 20, weapon: "hegrenade" },
        { tick: 120, attacker: 0, victim: 1, damage: 40, weapon: "ak47" },
      ],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.heDamage).toBe(57);
    expect(u.he).toHaveLength(1);
  });

  it("counts smokes thrown vs landed in A/B", () => {
    const m = replay({
      grenades: [smoke(-1460, 705, 1), smoke(1320, 1936, 0), smoke(-70, 1324, 1)],
    });
    const u = utilityThrough(m, 640, null);
    expect(u.smokesThrown).toBe(3);
    expect(u.smokesInSite).toBe(2);
    expect(u.smokesA).toBe(1);
    expect(u.smokesB).toBe(1);
    const onlyBob = utilityThrough(m, 640, 1);
    expect(onlyBob.smokesThrown).toBe(2);
    expect(onlyBob.smokesInSite).toBe(1);
  });
});
