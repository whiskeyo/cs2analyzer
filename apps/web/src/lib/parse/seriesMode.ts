import type { SeriesHabitsState } from "@/lib/state/useSeriesHabits";
import type { DemoSeries } from "./session";
import type { DemoSession } from "./useDemoSession";

/** More than one demo in the loaded series (habits / overlay UI applies). */
export function isMultiDemoSeries(series: DemoSeries | null | undefined): series is DemoSeries {
  return series != null && series.demos.length > 1;
}

/** Show the series bar (multi-demo on one map, or multiple map groups from a drop). */
export function showSeriesBar(
  session: Pick<DemoSession, "series" | "mapGroups">,
): session is Pick<DemoSession, "series" | "mapGroups"> & { series: DemoSeries } {
  if (!session.series) {
    return false;
  }
  return isMultiDemoSeries(session.series) || session.mapGroups.length > 1;
}

/** Aggregated habits view: series-wide round strip and sidebar tabs. */
export function isAggregatedView(
  series: DemoSeries | null | undefined,
  habits: Pick<SeriesHabitsState, "aggregated">,
): boolean {
  return habits.aggregated && isMultiDemoSeries(series);
}

/** Bucket overlay playback: aggregated + overlay toggle + selected CT/T × buy bucket. */
export function isBucketOverlayActive(
  series: DemoSeries | null | undefined,
  habits: Pick<SeriesHabitsState, "aggregated" | "overlayOn" | "bucketOverlay">,
): boolean {
  return isAggregatedView(series, habits) && habits.bucketOverlay != null && habits.overlayOn;
}
