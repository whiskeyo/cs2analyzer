import { describe, expect, it } from "vitest";
import { computeStats, teamEntryShare, weaponBreakdown } from "./stats";
import { makeHurt, makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";

describe("computeStats", () => {
  it("caps ADR at remaining HP and ignores overkill", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
      hurts: [makeHurt(90, 0, 1, 110)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[1].deaths).toBe(1);
    expect(stats[0].adr).toBe(100);
  });

  it("does not treat the killer's next frag as a trade", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 1, 0), makeKill(120, 1, 2)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kast_rounds).toBe(0);
    expect(stats[1].trade_kills).toBe(0);
    expect(stats[2].trade_kills).toBe(0);
  });

  it("counts a teammate killing the attacker as a trade", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 1, 0), makeKill(120, 2, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kast_rounds).toBe(1);
    expect(stats[2].trade_kills).toBe(1);
    expect(stats[0].trade_deaths).toBe(1);
  });

  it("omits suicides from kills and deaths", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 0), makeKill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[0].deaths).toBe(0);
    expect(stats[1].deaths).toBe(1);
  });

  it("omits world / trigger_hurt deaths from kills and deaths", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, -1, 0, { weapon: "world" }), makeKill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[0].deaths).toBe(0);
    expect(stats[1].deaths).toBe(1);
  });

  it("does not credit teamkills and skips them as the opening duel", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 2), makeKill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[2].deaths).toBe(1);
    expect(stats[0].first_kills).toBe(1);
    expect(stats[1].first_deaths).toBe(1);
    expect(stats[2].first_deaths).toBe(0);
  });

  it("reports entry success from the opening duel", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].entry_attempts).toBe(1);
    expect(stats[0].entry_success).toBe(100);
    expect(stats[1].entry_attempts).toBe(1);
    expect(stats[1].entry_success).toBe(0);
  });

  it("splits kills and ADR by the side the player was on", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
      hurts: [makeHurt(90, 0, 1, 40)],
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
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1, { assister: 1 })],
    });
    const stats = computeStats(m, 640);
    expect(stats[1].assists).toBe(0);
  });

  it("does not add friendly-fire to ADR", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      hurts: [makeHurt(90, 0, 2, 50), makeHurt(95, 0, 1, 40)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].adr).toBe(40);
  });
});

describe("teamEntryShare", () => {
  it("is the player's share of opening duels on the starting side", () => {
    const players = [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")];
    const m = makeReplay({
      players,
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
        makeRound({
          number: 2,
          winner: "T",
          start_tick: 641,
          freeze_end_tick: 705,
          end_tick: 1280,
        }),
      ],
      kills: [makeKill(100, 0, 1), makeKill(800, 1, 2)],
    });
    const stats = computeStats(m, 1280);
    expect(teamEntryShare(stats, players, 0)).toEqual({
      attempts: 1,
      teamAttempts: 2,
      pct: 50,
    });
    expect(teamEntryShare(stats, players, 2).pct).toBe(50);
    expect(teamEntryShare(stats, players, 1).pct).toBe(100);
  });
});

describe("weaponBreakdown", () => {
  const m = makeReplay({
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    rounds: [
      makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
    ],
    kills: [
      makeKill(200, 0, 1, { weapon: "ak47", headshot: true }),
      makeKill(400, 1, 0, { weapon: "deagle" }),
    ],
    hurts: [makeHurt(200, 0, 1, 100, { weapon: "ak47" })],
  });

  it("tallies kills, headshots and damage per weapon, best first", () => {
    const rows = weaponBreakdown(m, 2000, null);
    expect(rows.map((r) => r.raw)).toEqual(["ak47", "deagle"]);
    expect(rows[0]).toMatchObject({ kills: 1, headshots: 1, damage: 100 });
  });

  it("narrows to one player when asked", () => {
    expect(weaponBreakdown(m, 2000, 0).map((r) => r.raw)).toEqual(["ak47"]);
  });

  it("caches per replay, whole tick and player", () => {
    const rows = weaponBreakdown(m, 2000, null);
    expect(weaponBreakdown(m, 2000.9, null)).toBe(rows);
    expect(weaponBreakdown(m, 2000, 0)).not.toBe(rows);
  });
});
