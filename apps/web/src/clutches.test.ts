import { describe, expect, it } from "vitest";
import { clutchAttempts } from "./clutches";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_PRESENT,
  type Kill,
  type Player,
  type Replay,
  type Round,
} from "./types";

function player(index: number, side: Player["start_side"], name: string): Player {
  return { index, steam_id: index + 1, name, start_side: side };
}

function round(partial: Partial<Round> & Pick<Round, "number" | "winner">): Round {
  return {
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 640,
    win_reason: 8,
    score_ct: 0,
    score_t: 0,
    is_knife: false,
    ...partial,
  };
}

function kill(tick: number, attacker: number, victim: number): Kill {
  return {
    tick,
    attacker,
    victim,
    assister: -1,
    weapon: "ak47",
    headshot: false,
    assisted_flash: false,
    x: 0,
    y: 0,
    z: 0,
  };
}

function ticksAtFreeze(playerCount: number, ctUntil: number) {
  const n = playerCount;
  const flags = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    flags[i] = FLAG_PRESENT | FLAG_ALIVE | (i < ctUntil ? FLAG_CT : 0);
  }
  return {
    frameCount: 1,
    playerCount: n,
    ticks: new Uint32Array([64]),
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    yaw: new Float32Array(n),
    health: new Uint8Array(n).fill(100),
    armor: new Uint8Array(n),
    flags,
    money: new Uint16Array(n),
    equip: new Uint16Array(n),
    gear: new Uint16Array(n),
    primary: new Uint8Array(n),
    secondary: new Uint8Array(n),
  };
}

function replay(partial: Partial<Replay> & Pick<Replay, "players" | "rounds" | "ticks">): Replay {
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
    grenades: [],
    shots: [],
    kills: [],
    hurts: [],
    blinds: [],
    bombEvents: [],
    stats: [],
    ...partial,
  };
}

describe("clutchAttempts", () => {
  it("records a 1v2 from the tick the last teammate died", () => {
    const m = replay({
      players: [
        player(0, "CT", "Alice"),
        player(1, "CT", "Bob"),
        player(2, "T", "T1"),
        player(3, "T", "T2"),
      ],
      rounds: [round({ number: 1, winner: "CT" })],
      ticks: ticksAtFreeze(4, 2),
      kills: [kill(200, 2, 0), kill(400, 1, 2), kill(500, 1, 3)],
    });
    const rows = clutchAttempts(m, 640);
    expect(rows.map((r) => ({ player: r.player, vs: r.vs, won: r.won, tick: r.tick }))).toEqual([
      { player: 1, vs: 2, won: true, tick: 200 },
      { player: 3, vs: 1, won: false, tick: 400 },
    ]);
  });

  it("skips unfinished and knife rounds", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [
        round({ number: 0, winner: "CT", is_knife: true, start_tick: 0, end_tick: 50 }),
        round({ number: 1, winner: "T", start_tick: 50, freeze_end_tick: 100, end_tick: 800 }),
      ],
      ticks: ticksAtFreeze(2, 1),
      kills: [kill(200, 1, 0)],
    });
    expect(clutchAttempts(m, 400)).toEqual([]);
    expect(clutchAttempts(m, 800).some((c) => c.player === 1 && c.vs === 1 && c.won)).toBe(true);
  });
});
