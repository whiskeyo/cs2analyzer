import type { PlayerStats, Replay } from "@/lib/replay/replayTypes";

export function formatAdr(adr: number): string {
  return adr.toFixed(2);
}

export function formatKast(kast: number): string {
  return `${kast.toFixed(1)}%`;
}

function utilityDamagePerRound(s: PlayerStats): string {
  return (s.rounds > 0 ? s.utility_damage / s.rounds : 0).toFixed(1);
}

export function exportStatsCsv(replay: Replay, stats: PlayerStats[]): string {
  const headers = [
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
  ];
  const rows = stats.map((s) => {
    const p = replay.players[s.player];
    return [
      p?.name ?? "?",
      p?.is_bot ? "" : (p?.steam_id ?? ""),
      s.rounds,
      s.kills,
      s.deaths,
      s.assists,
      `${s.kast.toFixed(2)}%`,
      s.adr.toFixed(2),
      s.first_kills,
      s.first_deaths,
      `${s.entry_success.toFixed(0)}%`,
      s.clutch_1v1,
      s.clutch_1v2,
      s.clutch_1v3,
      s.clutch_1v4,
      s.clutch_1v5,
      s.multi_kills_2,
      s.multi_kills_3,
      s.multi_kills_4,
      s.aces,
      s.trade_kills,
      s.trade_deaths,
      utilityDamagePerRound(s),
      s.flash_assists,
      s.plants,
      s.defuses,
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}
