import { isBucketOverlayActive } from "@/lib/parse/seriesMode";
import type { DemoSeries } from "@/lib/parse/session";
import type { SeriesOverlay } from "@/lib/parse/seriesOverlay";
import type { SeriesHabitsState } from "@/lib/state/useSeriesHabits";

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

type AggregatedHabits = Pick<SeriesHabitsState, "aggregated" | "overlayOn" | "bucketOverlay">;

/**
 * Colour → name rows for the Analyzer radar.
 * Only the multi-demo Aggregated overlay (HUD is off there). Live single-demo
 * rounds keep the score HUD and do not get a corner list.
 */
export function analyzerPawnLegend(
  series: DemoSeries | null | undefined,
  habits: AggregatedHabits,
  overlay?: SeriesOverlay | null,
): LegendEntry[] {
  if (!isBucketOverlayActive(series, habits) || !overlay) return [];
  return uniquePawnLegend(
    overlay.trails.map((trail) => ({
      label: trail.playerName,
      color: trail.color,
    })),
  );
}
