import { describe, expect, it } from "vitest";
import { playerReview } from "./review";
import type { Kill, Player, Replay, Round } from "./types";

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

describe("playerReview", () => {
  it("records winning the opening duel", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 1)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.headlines.some((h) => h.text.includes("Won 1 opening"))).toBe(true);
    expect(
      review.notes.some((n) => n.title.startsWith("Won the opening") && n.severity === "good"),
    ).toBe(true);
  });

  it("records a 4k as a highlight", () => {
    const m = replay({
      players: [
        player(0, "CT", "A"),
        player(1, "T", "B"),
        player(2, "T", "C"),
        player(3, "T", "D"),
        player(4, "T", "E"),
      ],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 1), kill(120, 0, 2), kill(140, 0, 3), kill(160, 0, 4)],
    });
    const review = playerReview(m, 0, 640);
    expect(review.notes.some((n) => n.title === "4k this round")).toBe(true);
    expect(review.headlines.some((h) => h.text.includes("4k+"))).toBe(true);
  });
});
