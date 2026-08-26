import { describe, expect, it } from "vitest";
import { samplePlayer, samplePlayers } from "./sample";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_PRESENT,
  type Player,
  type Replay,
  type Round,
} from "@/lib/replay/replayTypes";

function emptyTicks(playerCount: number, frameCount: number) {
  const n = playerCount * frameCount;
  return {
    frameCount,
    playerCount,
    ticks: new Uint32Array(frameCount),
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    yaw: new Float32Array(n),
    health: new Uint8Array(n),
    armor: new Uint8Array(n),
    flags: new Uint8Array(n),
    money: new Uint16Array(n),
    equip: new Uint16Array(n),
    gear: new Uint16Array(n),
    primary: new Uint8Array(n),
    secondary: new Uint8Array(n),
  };
}

function replay(ticks: Replay["ticks"]): Replay {
  const players: Player[] = [
    { index: 0, steam_id: 1, name: "A", start_side: "CT" },
    { index: 1, steam_id: 2, name: "B", start_side: "T" },
  ];
  const rounds: Round[] = [
    {
      number: 1,
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 640,
      winner: "CT",
      win_reason: 8,
      score_ct: 1,
      score_t: 0,
      is_knife: false,
    },
  ];
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
    players,
    rounds,
    grenades: [],
    shots: [],
    kills: [],
    hurts: [],
    blinds: [],
    bombEvents: [],
    stats: [],
    ticks,
  };
}

describe("samplePlayer", () => {
  it("returns one pawn and null for a missing slot", () => {
    const ticks = emptyTicks(2, 1);
    ticks.ticks[0] = 80;
    ticks.x[0] = 10;
    ticks.y[0] = 20;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = replay(ticks);
    const a = samplePlayer(m, 0, 80);
    expect(a?.x).toBe(10);
    expect(a?.ct).toBe(true);
    expect(samplePlayer(m, 2, 80)).toBeNull();
    expect(samplePlayers(m, 80)).toHaveLength(2);
  });
});
