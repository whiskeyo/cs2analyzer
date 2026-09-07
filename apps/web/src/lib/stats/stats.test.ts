import { describe, expect, it } from "vitest";
import { computeStats, teamEntryShare, weaponBreakdown } from "./stats";
import {
  makeFreezeTicks,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { WEAPON_BY_ID } from "@/lib/weapons/weapons";

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

  it("credits M4A1-S / USP-S damage when hurts use the unsilenced class name", () => {
    const ticks = makeFreezeTicks(2, 1, 64);
    ticks.active[0] = WEAPON_BY_ID.indexOf("m4a1_silencer");
    ticks.primary[0] = WEAPON_BY_ID.indexOf("m4a1_silencer");
    ticks.secondary[0] = WEAPON_BY_ID.indexOf("usp_silencer");
    const mixed = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks,
      kills: [
        makeKill(200, 0, 1, { weapon: "m4a1_silencer", headshot: true }),
        makeKill(400, 0, 1, { weapon: "usp_silencer" }),
      ],
      hurts: [
        makeHurt(200, 0, 1, 80, { weapon: "m4a1" }),
        makeHurt(400, 0, 1, 35, { weapon: "hkp2000" }),
      ],
    });
    const rows = weaponBreakdown(mixed, 2000, 0);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.weapon === "M4A1-S")).toMatchObject({
      kills: 1,
      headshots: 1,
      damage: 80,
    });
    expect(rows.find((r) => r.weapon === "USP-S")).toMatchObject({ kills: 1, damage: 35 });
    expect(rows.find((r) => r.weapon === "M4A4")).toBeUndefined();
    expect(rows.find((r) => r.weapon === "P2000")).toBeUndefined();
  });

  it("keeps M4A4 / P2000 damage when that is the gun in hand", () => {
    const ticks = makeFreezeTicks(2, 1, 64);
    ticks.active[0] = WEAPON_BY_ID.indexOf("m4a1");
    ticks.primary[0] = WEAPON_BY_ID.indexOf("m4a1");
    ticks.secondary[0] = WEAPON_BY_ID.indexOf("hkp2000");
    const mixed = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks,
      hurts: [
        makeHurt(200, 0, 1, 80, { weapon: "m4a1" }),
        makeHurt(400, 0, 1, 35, { weapon: "hkp2000" }),
      ],
    });
    const rows = weaponBreakdown(mixed, 2000, 0);
    expect(rows.find((r) => r.weapon === "M4A4")).toMatchObject({ damage: 80 });
    expect(rows.find((r) => r.weapon === "P2000")).toMatchObject({ damage: 35 });
  });
});
