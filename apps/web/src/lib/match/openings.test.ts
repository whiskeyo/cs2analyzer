import { describe, expect, it } from "vitest";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { openingDuels } from "./openings";

describe("openingDuels", () => {
  it("is the first enemy kill of each competitive round", () => {
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Bob"),
        makePlayer(2, "CT", "Cara"),
      ],
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          start_tick: 0,
          freeze_end_tick: 10,
          end_tick: 40,
          winner: "CT",
        }),
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 50,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
        makeRound({
          number: 2,
          winner: "T",
          start_tick: 700,
          freeze_end_tick: 760,
          end_tick: 1400,
        }),
      ],
      kills: [
        makeKill(20, 0, 1),
        makeKill(70, 0, 2),
        makeKill(120, 0, 1, {
          weapon: "awp",
          headshot: true,
          attacker_x: 10,
          attacker_y: 20,
          x: 200,
          y: 40,
        }),
        makeKill(200, 1, 0),
        makeKill(800, 1, 0, { weapon: "ak47" }),
      ],
    });

    const rows = openingDuels(replay);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      round: 1,
      roundLabel: "R1",
      tick: 120,
      killer: "Alice",
      victim: "Bob",
      killerIndex: 0,
      victimIndex: 1,
      side: "CT",
      weapon: "AWP HS",
      teamWon: true,
      marks: { attacker: { x: 10, y: 20 }, victim: { x: 200, y: 40 } },
    });
    expect(rows[1]).toMatchObject({
      round: 2,
      roundLabel: "R2",
      tick: 800,
      killer: "Bob",
      victim: "Alice",
      side: "T",
      weapon: "AK-47",
      teamWon: true,
      marks: null,
    });
  });

  it("ignores a kill during freeze and keeps the first kill after it", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [
        makeRound({
          number: 3,
          freeze_end_tick: 64,
          end_tick: 640,
          winner: "T",
        }),
      ],
      kills: [makeKill(10, 0, 1), makeKill(100, 1, 0, { weapon: "glock" })],
    });
    expect(openingDuels(replay)).toMatchObject([
      {
        round: 3,
        tick: 100,
        killer: "Bob",
        victim: "Alice",
        weapon: "Glock",
        teamWon: true,
      },
    ]);
  });

  it("keeps the earliest kill when two frags share a tick", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(120, 0, 1), makeKill(120, 1, 0)],
    });
    expect(openingDuels(replay)[0]).toMatchObject({
      killer: "Alice",
      victim: "Bob",
      tick: 120,
    });
  });

  it("leaves the round result unset when the round has no winner", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: null })],
      kills: [makeKill(120, 0, 1)],
    });
    expect(openingDuels(replay)[0]?.teamWon).toBeNull();
  });

  it("marks the opening lost when the other side wins the round", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      kills: [makeKill(120, 0, 1)],
    });
    expect(openingDuels(replay)[0]?.teamWon).toBe(false);
  });

  it("returns nothing when a round has no enemy kill", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "CT", "Cara")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(120, 0, 1)],
    });
    expect(openingDuels(replay)).toEqual([]);
  });
});
