import type { PlayerStats, Replay } from "@/lib/replay/replayTypes";

export function formatAdr(adr: number): string {
  return adr.toFixed(2);
}

export function formatKast(kast: number): string {
  return `${kast.toFixed(1)}%`;
}

export function exportStatsCsv(replay: Replay, stats: PlayerStats[], tick: number): string {
  const headers = [
    "Player",
    "Steam64",
    "K",
    "D",
    "A",
    "ADR",
    "KAST",
    "HS%",
    "Rating",
    "FK",
    "FD",
    "Trades",
    "UD",
    "Flashes",
    "Nades",
    "Clutch W/A",
    "Plants",
    "Defuses",
  ];
  const rows = stats.map((s) => {
    const p = replay.players[s.player];
    return [
      p?.name ?? "?",
      p?.steam_id ?? "",
      s.kills,
      s.deaths,
      s.assists,
      s.adr.toFixed(2),
      formatKast(s.kast),
      s.headshot_percent.toFixed(1),
      s.rating.toFixed(2),
      s.first_kills,
      s.first_deaths,
      s.trade_kills,
      s.utility_damage,
      s.enemies_flashed,
      s.nades,
      `${s.clutch_wins}/${s.clutch_attempts}`,
      s.plants,
      s.defuses,
    ].join(",");
  });
  return [`# ${replay.header.map_name} tick ${Math.floor(tick)}`, headers.join(","), ...rows].join(
    "\n",
  );
}
