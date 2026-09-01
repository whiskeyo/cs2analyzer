import { describe, expect, it } from "vitest";
import type { PlayerStats } from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { exportStatsCsv, formatAdr, formatKast } from "./format";

describe("formatAdr / formatKast", () => {
  it("formats ADR and KAST for display", () => {
    expect(formatAdr(77.123)).toBe("77.12");
    expect(formatKast(77.12)).toBe("77.1%");
  });
});

describe("exportStatsCsv", () => {
  it("writes a header comment, column row, and stat rows", () => {
    const replay = makeReplay({
      header: { map_name: "de_mirage" },
      players: [makePlayer(0, "CT", "Alpha", 111), makePlayer(1, "T", "Bravo", 222)],
    });
    const stats: PlayerStats[] = [
      {
        player: 0,
        kills: 20,
        deaths: 15,
        assists: 4,
        headshots: 8,
        damage: 2000,
        utility_damage: 120,
        enemies_flashed: 3,
        first_kills: 5,
        first_deaths: 2,
        kast_rounds: 18,
        rounds: 24,
        adr: 83.33,
        headshot_percent: 40,
        kast: 75,
        kd: 1.33,
        multi_kills_2: 4,
        multi_kills_3: 2,
        multi_kills_4: 1,
        aces: 0,
        flash_assists: 1,
        plants: 2,
        defuses: 1,
        trade_kills: 3,
        trade_deaths: 1,
        entry_attempts: 6,
        entry_success: 4,
        rounds_ct: 12,
        rounds_t: 12,
        kills_ct: 10,
        kills_t: 10,
        deaths_ct: 7,
        deaths_t: 8,
        damage_ct: 1000,
        damage_t: 1000,
        adr_ct: 83,
        adr_t: 83,
        kills_per_round: 0.83,
        deaths_per_round: 0.63,
        impact: 1.1,
        rating: 1.15,
        flash_time: 12,
        nades: 40,
        he_kills: 1,
        survived: 9,
        clutch_attempts: 2,
        clutch_wins: 1,
        clutch_1v1: 1,
        clutch_1v2: 0,
        clutch_1v3: 0,
        damage_taken: 1500,
      },
    ];
    const csv = exportStatsCsv(replay, stats, 640.7);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("# de_mirage tick 640");
    expect(lines[1]).toContain("Player,Steam64,K");
    expect(lines[2]).toContain("Alpha,111,20,15,4,83.33,75.0%,40.0,1.15");
    expect(lines[2]).toContain("1/2,2,1");
  });

  it("falls back when player metadata is missing", () => {
    const replay = makeReplay({ players: [] });
    const stats: PlayerStats[] = [
      {
        player: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        headshots: 0,
        damage: 0,
        utility_damage: 0,
        enemies_flashed: 0,
        first_kills: 0,
        first_deaths: 0,
        kast_rounds: 0,
        rounds: 0,
        adr: 0,
        headshot_percent: 0,
        kast: 0,
        kd: 0,
        multi_kills_2: 0,
        multi_kills_3: 0,
        multi_kills_4: 0,
        aces: 0,
        flash_assists: 0,
        plants: 0,
        defuses: 0,
        trade_kills: 0,
        trade_deaths: 0,
        entry_attempts: 0,
        entry_success: 0,
        rounds_ct: 0,
        rounds_t: 0,
        kills_ct: 0,
        kills_t: 0,
        deaths_ct: 0,
        deaths_t: 0,
        damage_ct: 0,
        damage_t: 0,
        adr_ct: 0,
        adr_t: 0,
        kills_per_round: 0,
        deaths_per_round: 0,
        impact: 0,
        rating: 0,
        flash_time: 0,
        nades: 0,
        he_kills: 0,
        survived: 0,
        clutch_attempts: 0,
        clutch_wins: 0,
        clutch_1v1: 0,
        clutch_1v2: 0,
        clutch_1v3: 0,
        damage_taken: 0,
      },
    ];
    const csv = exportStatsCsv(replay, stats, 0);
    expect(csv.split("\n")[2]).toMatch(/^\?,,\d/);
  });
});
