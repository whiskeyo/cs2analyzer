import type { SeriesOverlay } from "@/lib/parse/seriesOverlay";
import { playerLabel } from "@/lib/replay/playerLabel";
import type { Replay } from "@/lib/replay/replayTypes";
import { samplePlayers } from "@/lib/replay/sample";
import { CT_COLOR, T_COLOR } from "./radarFrame";

export interface LegendEntry {
  label: string;
  color: string;
}

/** First colour for each non-blank label (Playbook snapshots and live Analyzer). */
export function uniquePawnLegend(
  rows: readonly { label?: string; color: string }[],
): LegendEntry[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const label = row.label?.trim();
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.set(label, row.color);
  }
  return [...seen.entries()].map(([label, color]) => ({ label, color }));
}

/**
 * Colour → name rows for the live Analyzer radar.
 * Habits overlay uses trail tints; otherwise present pawns use side colours.
 */
export function livePawnLegend(
  replay: Replay,
  tick: number,
  overlay?: SeriesOverlay | null,
): LegendEntry[] {
  if (overlay) {
    return uniquePawnLegend(
      overlay.trails.map((trail) => ({ label: trail.playerName, color: trail.color })),
    );
  }
  return uniquePawnLegend(
    samplePlayers(replay, tick)
      .filter((player) => player.present)
      .map((player) => ({
        label: playerLabel(replay.players[player.index], ""),
        color: player.ct ? CT_COLOR : T_COLOR,
      })),
  );
}
