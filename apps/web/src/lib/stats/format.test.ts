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

function sampleStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
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
    entry_success: 83.333,
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
    clutch_1v4: 0,
    clutch_1v5: 0,
    clutch_1v1_attempts: 2,
    clutch_1v2_attempts: 0,
    clutch_1v3_attempts: 0,
    clutch_1v4_attempts: 0,
    clutch_1v5_attempts: 0,
    damage_taken: 1500,
    ...overrides,
  };
}

describe("exportStatsCsv", () => {
  it("writes columns matching the spreadsheet template", () => {
    const replay = makeReplay({
      header: { map_name: "de_mirage" },
      players: [makePlayer(0, "CT", "Alpha", 111), makePlayer(1, "T", "Bravo", 222)],
    });
    const csv = exportStatsCsv(replay, [sampleStats()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      [
        "Player",
        "Steam64",
        "Rounds",
        "Kills",
        "Deaths",
        "Assists",
        "KAST%",
        "ADR",
        "First Kills",
        "First Deaths",
        "Entry Success",
        "Clutch 1v1",
        "Clutch 1v2",
        "Clutch 1v3",
        "Clutch 1v4",
        "Clutch 1v5",
        "Multikill 2K",
        "Multikill 3K",
        "Multikill 4K",
        "Multikill 5K",
        "Trades (got)",
        "Trades (was)",
        "UDPR",
        "Flash Assists",
        "Bomb plants",
        "Bomb defuses",
      ].join(","),
    );
    expect(lines[1]).toBe(
      "Alpha,111,24,20,15,4,75.00%,83.33,5,2,83%,1,0,0,0,0,4,2,1,0,3,1,5.0,1,2,1",
    );
  });

  it("falls back when player metadata is missing", () => {
    const replay = makeReplay({ players: [] });
    const csv = exportStatsCsv(replay, [sampleStats({ player: 0, rounds: 0 })]);
    expect(csv.split("\n")[1]).toMatch(/^\?,,0,/);
  });
});
