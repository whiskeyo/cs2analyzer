import { describe, expect, it } from "vitest";
import { filterExecutes, findExecutes, nextExecuteTick } from "./execute";
import type { GrenadeThrow, Kill, Player, Replay, Round } from "./types";

function player(index: number, side: Player["start_side"], name: string): Player {
  return { index, steam_id: index + 1, name, start_side: side };
}

function round(partial: Partial<Round> & Pick<Round, "number" | "winner">): Round {
  return {
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 2000,
    win_reason: 1,
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

function nade(
  tick: number,
  thrower: number,
  kind: GrenadeThrow["kind"],
  x?: number,
  y?: number,
): GrenadeThrow {
  return {
    thrower,
    kind,
    start_tick: tick - 32,
    detonate_tick: tick,
    end_tick: tick + 64,
    points: x == null || y == null ? [] : [{ tick, x, y, z: 0 }],
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
];

describe("findExecutes", () => {
  it("labels a Dust2 A dump as A", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      header: {
        map_name: "de_dust2",
        tick_rate: 64,
        tick_stride: 4,
        duration_s: 10,
        playback_ticks: 1920,
        team_ct: "CT",
        team_t: "T",
        score_ct: 0,
        score_t: 0,
      },
      grenades: [nade(200, 0, "smoke", 1128, 2518), nade(220, 1, "smoke", 1180, 2480)],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].site).toBe("A");
    expect(beats[0].title).toMatch(/A/);
  });

  it("labels an Anubis A plant as A, not Mid", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
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
      bombEvents: [{ tick: 400, kind: "planted", player: 0, x: -658, y: 1835, z: 80 }],
    });
    const beats = findExecutes(m);
    const plant = beats.find((b) => b.kind === "plant");
    expect(plant?.site).toBe("A");
    expect(plant?.title).toMatch(/A/);
  });

  it("treats a T smoke dump as an execute", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke"), nade(220, 1, "smoke"), nade(240, 2, "molotov")],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].kind).toBe("execute");
    expect(beats[0].side).toBe("T");
    expect(beats[0].tick).toBeLessThan(200);
  });

  it("ignores a lonely opening duel", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(120, 0, 3)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("ignores a 2k opening", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [kill(120, 0, 3), kill(180, 1, 4)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("keeps a 3k burst as a fight", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      kills: [kill(300, 0, 3), kill(320, 1, 4), kill(340, 0, 4)],
    });
    const beats = findExecutes(m);
    expect(beats.some((b) => b.kind === "fight")).toBe(true);
  });

  it("marks a plant and a later CT util dump as a retake", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [
        nade(200, 0, "smoke"),
        nade(210, 1, "smoke"),
        nade(900, 3, "smoke"),
        nade(920, 4, "molotov"),
      ],
      bombEvents: [{ tick: 400, kind: "planted", player: 0, x: 0, y: 0, z: 0 }],
    });
    const beats = findExecutes(m);
    expect(beats.some((b) => b.kind === "execute" && b.side === "T")).toBe(true);
    expect(beats.some((b) => b.kind === "retake")).toBe(true);
  });

  it("nextExecuteTick walks forward and back", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke"), nade(220, 1, "smoke")],
      bombEvents: [{ tick: 1100, kind: "planted", player: 0, x: 0, y: 0, z: 0 }],
    });
    const beats = findExecutes(m);
    expect(beats.length).toBeGreaterThanOrEqual(2);
    expect(nextExecuteTick(beats, beats[0].tick, 1)).toBe(beats[1].tick);
    expect(nextExecuteTick(beats, beats[1].tick, -1)).toBe(beats[0].tick);
  });

  it("ignores CT smokes on opposite sides of the map", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [nade(200, 3, "smoke", 0, 0), nade(220, 4, "smoke", 3200, 0)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("ignores T smokes that land on opposite bombsites", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke", 0, 0), nade(220, 1, "smoke", 0, 3200)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("still treats clustered T smokes as an execute", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [
        nade(200, 0, "smoke", 0, 0),
        nade(220, 1, "smoke", 400, 80),
        nade(240, 2, "molotov", 180, 40),
      ],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].kind).toBe("execute");
    expect(beats[0].side).toBe("T");
  });

  it("labels util and kills per side instead of summing both teams", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [
        nade(200, 0, "smoke"),
        nade(210, 1, "smoke"),
        nade(220, 2, "molotov"),
        nade(230, 3, "smoke"),
        nade(240, 4, "molotov"),
        nade(250, 3, "flash"),
        nade(260, 4, "he"),
      ],
      kills: [kill(230, 0, 3), kill(250, 1, 4)],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].detail).toMatch(/T .*2 smokes/);
    expect(beats[0].detail).toMatch(/T .*2k/);
    expect(beats[0].detail).toMatch(/CT .*1 smoke/);
    expect(beats[0].detail).toMatch(/CT .*2 util/);
    expect(beats[0].detail).not.toMatch(/7 smoke/);
    expect(beats[0].detail).not.toMatch(/(^|· )4k( ·|$)/);
  });

  it("does not call a CT default dump a take", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [nade(200, 3, "smoke", 0, 0), nade(220, 4, "smoke", 300, 40)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("filterExecutes keeps a plant and drops T executes", () => {
    const m = replay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [nade(200, 0, "smoke"), nade(220, 1, "smoke")],
      bombEvents: [{ tick: 1100, kind: "planted", player: 0, x: 0, y: 0, z: 0 }],
    });
    const beats = findExecutes(m);
    expect(filterExecutes(beats, { kinds: ["plant"] }).every((b) => b.kind === "plant")).toBe(true);
    expect(filterExecutes(beats, { side: "CT" }).every((b) => b.side === "CT")).toBe(true);
  });
});
