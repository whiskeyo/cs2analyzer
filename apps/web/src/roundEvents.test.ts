import { describe, expect, it } from "vitest";
import { clampLeadInSec, eventsForRound, jumpBefore, roundClock } from "./roundEvents";
import type { BombEvent, GrenadeThrow, Kill, Player, Replay, Round } from "./types";

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

function nade(start: number, thrower: number, kind: GrenadeThrow["kind"]): GrenadeThrow {
  return {
    thrower,
    kind,
    start_tick: start,
    detonate_tick: start + 40,
    end_tick: start + 80,
    points: [],
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

const roster = [player(0, "T", "T1"), player(1, "CT", "CT1")];
const r1 = round({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 });
const r2 = round({
  number: 2,
  winner: "CT",
  start_tick: 2001,
  freeze_end_tick: 2065,
  end_tick: 4000,
});

describe("eventsForRound", () => {
  it("lists kills and throws in this round, nades first when ticks tie", () => {
    const m = replay({
      players: roster,
      rounds: [r1, r2],
      kills: [kill(500, 0, 1), kill(2500, 1, 0), kill(80, 1, 0)],
      grenades: [nade(500, 0, "smoke"), nade(2100, 1, "flash"), nade(120, 0, "he")],
    });
    const events = eventsForRound(m, r1);
    expect(events.map((e) => [e.kind, e.tick])).toEqual([
      ["kill", 80],
      ["nade", 120],
      ["nade", 500],
      ["kill", 500],
    ]);
  });

  it("lists bomb plant and defuse, skipping abort, between nades and kills on a tie", () => {
    const bomb = (
      tick: number,
      kind: BombEvent["kind"],
      player: number,
      extra: Partial<BombEvent> = {},
    ): BombEvent => ({ tick, kind, player, x: 0, y: 0, z: 0, ...extra });
    const m = replay({
      players: roster,
      rounds: [r1, r2],
      kills: [kill(900, 0, 1)],
      grenades: [nade(900, 0, "smoke")],
      bombEvents: [
        bomb(800, "planted", 0),
        bomb(850, "begin_defuse", 1, { haskit: true }),
        bomb(860, "abort_defuse", 1),
        bomb(900, "defused", 1),
        bomb(2500, "planted", 0),
      ],
    });
    const events = eventsForRound(m, r1);
    expect(events.map((e) => [e.kind, e.tick, e.kind === "bomb" ? e.bomb : ""])).toEqual([
      ["bomb", 800, "planted"],
      ["bomb", 850, "begin_defuse"],
      ["nade", 900, ""],
      ["bomb", 900, "defused"],
      ["kill", 900, ""],
    ]);
  });

  it("ignores events from other rounds", () => {
    const m = replay({
      players: roster,
      rounds: [r1, r2],
      kills: [kill(2500, 1, 0)],
      grenades: [nade(2100, 1, "molotov")],
    });
    expect(eventsForRound(m, r1)).toEqual([]);
    expect(eventsForRound(m, r2).map((e) => e.kind)).toEqual(["nade", "kill"]);
  });
});

describe("jumpBefore", () => {
  const m = replay({ players: roster, rounds: [r1] });

  it("rewinds 1.5s at 64 tick without leaving the round", () => {
    expect(jumpBefore(m, r1, 64 + 192, 1.5)).toBe(64 + 96);
    expect(jumpBefore(m, r1, 64 + 200, 1.5)).toBe(64 + 200 - 96);
  });

  it("does not rewind into freeze when the event is later", () => {
    expect(jumpBefore(m, r1, 80, 2)).toBe(64);
  });

  it("lands on the event when lead-in is zero", () => {
    expect(jumpBefore(m, r1, 500, 0)).toBe(500);
  });
});

describe("clampLeadInSec", () => {
  it("snaps to half seconds inside 0–5", () => {
    expect(clampLeadInSec(1.24)).toBe(1);
    expect(clampLeadInSec(1.26)).toBe(1.5);
    expect(clampLeadInSec(-3)).toBe(0);
    expect(clampLeadInSec(9)).toBe(5);
    expect(clampLeadInSec(Number.NaN)).toBe(1.5);
  });
});

describe("roundClock", () => {
  it("counts from freeze end", () => {
    expect(roundClock(r1, 64 + 128, 64)).toBe("0:02");
  });
});
