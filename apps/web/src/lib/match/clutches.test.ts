import { describe, expect, it } from "vitest";
import { clutchAttempts } from "./clutches";
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
