import { describe, expect, it } from "vitest";
import { roundStories } from "./roundStory";
import type { Kill, Player, Replay, Round } from "@/lib/replay/replayTypes";

function player(index: number, side: Player["start_side"], name: string): Player {
  return { index, steam_id: index + 1, name, start_side: side };
}

function round(partial: Partial<Round> & Pick<Round, "number" | "winner">): Round {
  return {
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 2000,
    win_reason: 9,
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

function replay(partial: Partial<Replay> & Pick<Replay, "players" | "rounds">): Replay {
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
    ticks: {
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
    },
    ...partial,
  };
}

const roster = [
  player(0, "T", "T1"),
  player(1, "T", "T2"),
  player(2, "T", "T3"),
  player(3, "CT", "CT1"),
  player(4, "CT", "CT2"),
  player(5, "CT", "CT3"),
  player(6, "CT", "CT4"),
  player(7, "CT", "CT5"),
];

describe("roundStories", () => {
  it("skips the knife round", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 0, winner: "T", is_knife: true, win_reason: 9 })],
      kills: [kill(100, 0, 3)],
    });
    expect(roundStories(m)).toEqual([]);
  });

  it("names the opener and T elim ending", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T", win_reason: 9 })],
      kills: [kill(120, 0, 3)],
    });
    const stories = roundStories(m);
    expect(stories).toHaveLength(1);
    expect(stories[0].opener).toEqual({ name: "T1", vs: "CT1", tick: 120 });
    expect(stories[0].ending).toBe("T elim");
    expect(stories[0].summary).toContain("T1 opener");
    expect(stories[0].summary).toContain("T elim");
  });

  it("marks a plant win as bomb", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 2, winner: "T", win_reason: 1 })],
      bombEvents: [{ tick: 800, kind: "planted", player: 0, x: 0, y: 0, z: 0 }],
    });
    const stories = roundStories(m);
    expect(stories[0].planted).toBe(true);
    expect(stories[0].ending).toBe("bomb");
  });

  it("marks a 5k as an ace", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 3, winner: "T", win_reason: 9 })],
      kills: [kill(100, 0, 3), kill(120, 0, 4), kill(140, 0, 5), kill(160, 0, 6), kill(180, 0, 7)],
    });
    const stories = roundStories(m);
    expect(stories[0].ace).toBe(true);
    expect(stories[0].ending).toBe("ace");
  });
});
