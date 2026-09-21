import { describe, expect, it } from "vitest";
import { WEAPON_BY_ID } from "@/lib/weapons/weapons";
import { clutchAttempts, clutchBoard } from "./clutches";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";

describe("clutchAttempts", () => {
  it("records a 1v2 from the tick the last teammate died", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "CT", "Bob"),
        makePlayer(2, "T", "T1"),
        makePlayer(3, "T", "T2"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      ticks: makeFreezeTicks(4, 2),
      kills: [makeKill(200, 2, 0), makeKill(400, 1, 2), makeKill(500, 1, 3)],
    });
    const rows = clutchAttempts(m, 640);
    expect(rows.map((r) => ({ player: r.player, vs: r.vs, won: r.won, tick: r.tick }))).toEqual([
      { player: 1, vs: 2, won: true, tick: 200 },
      { player: 3, vs: 1, won: false, tick: 400 },
    ]);
  });

  it("skips unfinished and knife rounds", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 0, winner: "CT", is_knife: true, start_tick: 0, end_tick: 50 }),
        makeRound({ number: 1, winner: "T", start_tick: 50, freeze_end_tick: 100, end_tick: 800 }),
      ],
      ticks: makeFreezeTicks(2, 1),
      kills: [makeKill(200, 1, 0)],
    });
    expect(clutchAttempts(m, 400)).toEqual([]);
    expect(clutchAttempts(m, 800).some((c) => c.player === 1 && c.vs === 1 && c.won)).toBe(true);
  });
});

describe("clutchBoard", () => {
  it("lists 1v2+ wins and losses with the gun and start position", () => {
    const ticks = makeFreezeTicks(4, 2);
    const ak = WEAPON_BY_ID.indexOf("ak47");
    ticks.active[1] = ak;
    ticks.x[1] = 120;
    ticks.y[1] = 340;
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "CT", "Bob"),
        makePlayer(2, "T", "T1"),
        makePlayer(3, "T", "T2"),
      ],
      rounds: [makeRound({ number: 3, winner: "CT" })],
      ticks,
      kills: [makeKill(200, 2, 0), makeKill(400, 1, 2), makeKill(500, 1, 3)],
    });
    expect(clutchBoard(m)).toEqual([
      {
        tick: 200,
        round: 3,
        roundLabel: "R3",
        player: 1,
        name: "Bob",
        vs: 2,
        side: "CT",
        won: true,
        weapon: "ak47",
        x: 120,
        y: 340,
        placed: true,
      },
    ]);
  });

  it("keeps a failed 1v3 and drops a 1v1 in the same round", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "CT", "Bob"),
        makePlayer(2, "T", "T1"),
        makePlayer(3, "T", "T2"),
        makePlayer(4, "T", "T3"),
      ],
      rounds: [makeRound({ number: 2, winner: "T" })],
      ticks: makeFreezeTicks(5, 2),
      kills: [makeKill(180, 2, 0), makeKill(260, 1, 2), makeKill(280, 1, 3), makeKill(300, 4, 1)],
    });
    const rows = clutchBoard(m);
    expect(rows.map((r) => ({ player: r.name, vs: r.vs, won: r.won, tick: r.tick }))).toEqual([
      { player: "Bob", vs: 3, won: false, tick: 180 },
    ]);
  });

  it("skips knife rounds", () => {
    const m = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "CT", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
      ],
      rounds: [
        makeRound({ number: 0, winner: "CT", is_knife: true, start_tick: 0, end_tick: 400 }),
      ],
      ticks: makeFreezeTicks(4, 2),
      kills: [makeKill(200, 2, 0)],
    });
    expect(clutchBoard(m)).toEqual([]);
  });
});
