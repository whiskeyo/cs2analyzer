import { describe, expect, it } from "vitest";
import { computeStats, liveScore } from "./stats";
import type { Kill, Player, Replay, Round } from "./types";

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
    ticks: emptyTicks(),
    ...partial,
  };
}

describe("computeStats", () => {
  it("caps ADR at remaining HP and ignores overkill", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 1)],
      hurts: [{ tick: 90, attacker: 0, victim: 1, damage: 110, weapon: "ak47" }],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[1].deaths).toBe(1);
    expect(stats[0].adr).toBe(100);
  });

  it("does not treat the killer's next frag as a trade", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B"), player(2, "CT", "C")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 1, 0), kill(120, 1, 2)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kast_rounds).toBe(0);
    expect(stats[1].trade_kills).toBe(0);
    expect(stats[2].trade_kills).toBe(0);
  });

  it("counts a teammate killing the attacker as a trade", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B"), player(2, "CT", "C")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 1, 0), kill(120, 2, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kast_rounds).toBe(1);
    expect(stats[2].trade_kills).toBe(1);
    expect(stats[0].trade_deaths).toBe(1);
  });

  it("omits suicides from kills and deaths", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 0), kill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[0].deaths).toBe(0);
    expect(stats[1].deaths).toBe(1);
  });

  it("does not credit teamkills and skips them as the opening duel", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B"), player(2, "CT", "C")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 2), kill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[2].deaths).toBe(1);
    expect(stats[0].first_kills).toBe(1);
    expect(stats[1].first_deaths).toBe(1);
    expect(stats[2].first_deaths).toBe(0);
  });

  it("reports entry success from the opening duel", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].entry_attempts).toBe(1);
    expect(stats[0].entry_success).toBe(100);
    expect(stats[1].entry_attempts).toBe(1);
    expect(stats[1].entry_success).toBe(0);
  });

  it("splits kills and ADR by the side the player was on", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(100, 0, 1)],
      hurts: [{ tick: 90, attacker: 0, victim: 1, damage: 40, weapon: "ak47" }],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills_ct).toBe(1);
    expect(stats[0].kills_t).toBe(0);
    expect(stats[0].adr_ct).toBe(40);
    expect(stats[0].adr_t).toBe(0);
    expect(stats[1].deaths_t).toBe(1);
    expect(stats[1].deaths_ct).toBe(0);
  });

  it("ignores same-side assists", () => {
    const k = kill(100, 0, 1);
    k.assister = 1;
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [k],
    });
    const stats = computeStats(m, 640);
    expect(stats[1].assists).toBe(0);
  });

  it("does not add friendly-fire to ADR", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B"), player(2, "CT", "C")],
      rounds: [round({ number: 1, winner: "CT" })],
      hurts: [
        { tick: 90, attacker: 0, victim: 2, damage: 50, weapon: "ak47" },
        { tick: 95, attacker: 0, victim: 1, damage: 40, weapon: "ak47" },
      ],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].adr).toBe(40);
  });
});

describe("liveScore", () => {
  it("attributes overtime side-swap wins to the starting teams", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B")],
      rounds: [
        round({ number: 12, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 200 }),
        round({
          number: 13,
          winner: "CT",
          start_tick: 201,
          freeze_end_tick: 250,
          end_tick: 400,
        }),
      ],
    });
    expect(liveScore(m, 200)).toEqual({ ct: 1, t: 0 });
    // Round 13 is swapped (MR12 halftime); a CT-side win belongs to the team that started T.
    expect(liveScore(m, 400)).toEqual({ ct: 1, t: 1 });
  });
});
