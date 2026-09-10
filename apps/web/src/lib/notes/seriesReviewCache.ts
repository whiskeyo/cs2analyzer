import type { LoadedDemo } from "@/lib/parse/session";
import type { FloorMode, RoundNote, SummaryFilter } from "./types";

/** In-memory review state while hopping between demos in a series (no IDB on each click). */
export interface SeriesReviewSnapshot {
  demo: LoadedDemo;
  tick: number;
  notes: RoundNote[];
  summaryFilter: SummaryFilter;
  floorMode: FloorMode;
  paletteId: string;
  color: string;
}

const cache = new Map<string, SeriesReviewSnapshot>();

export function getSeriesReview(demoId: string): SeriesReviewSnapshot | undefined {
  return cache.get(demoId);
}

export function getSeriesReviewTick(demoId: string | null): number | undefined {
  if (!demoId) return undefined;
  const hit = cache.get(demoId);
  return hit && hit.tick > 0 ? hit.tick : undefined;
}

export function setSeriesReview(snapshot: SeriesReviewSnapshot): void {
  cache.set(snapshot.demo.id, snapshot);
}

export function clearSeriesReviewCache(): void {
  cache.clear();
}

export function seriesReviewEntries(): SeriesReviewSnapshot[] {
  return [...cache.values()];
}
