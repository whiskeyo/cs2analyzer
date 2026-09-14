import type { PlayerStats } from "@/lib/replay/replayTypes";

/** Compact HS% for the Review tab. Null when the player has no enemy kills. */
export function reviewHeadshotLine(stats: PlayerStats | null | undefined): string | null {
  if (!stats || stats.kills <= 0) {
    return null;
  }
  return `${stats.headshot_percent.toFixed(0)}% HS (${stats.headshots}/${stats.kills})`;
}
