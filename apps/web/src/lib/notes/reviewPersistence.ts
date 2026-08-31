import { matchEndTick, matchScorecard, savedPlayerSnapshots } from "@/lib/stats/stats";
import type { LoadedDemo } from "@/lib/parse/session";
import {
  clearSeriesReviewCache,
  seriesReviewEntries,
  type SeriesReviewSnapshot,
} from "./seriesReviewCache";
import {
  defaultColor,
  defaultPaletteId,
  loadProject,
  matchKey,
  PROJECT_SCHEMA,
  saveProject,
  type ReviewProject,
} from "./projectStore";
import { DEFAULT_SUMMARY_FILTER, type FloorMode, type Stroke, type SummaryFilter } from "./types";

export interface ReviewOverlay {
  summaryFilter: SummaryFilter;
  floorMode: FloorMode;
  paletteId: string;
  color: string;
}

export interface PersistReviewOpts {
  withStats?: boolean;
}

/** Build a saved-note row for IndexedDB (optionally refreshing scorecard stats). */
export function projectFromDemo(
  target: LoadedDemo,
  tick: number,
  strokes: Stroke[],
  overlay: ReviewOverlay,
  existing: ReviewProject | null | undefined,
  opts: PersistReviewOpts = {},
): ReviewProject {
  const withStats = opts.withStats !== false;
  const endTick = matchEndTick(target.replay);
  let scorecard = existing?.scorecard;
  let playerStats = existing?.playerStats;
  if (withStats) {
    scorecard = matchScorecard(target.replay, endTick);
    playerStats = savedPlayerSnapshots(target.replay, endTick);
  }
  return {
    schema: PROJECT_SCHEMA,
    key: matchKey(target.replay, target.fileName),
    savedAt: Date.now(),
    fileName: target.fileName,
    mapName: target.replay.header.map_name,
    tick,
    strokes,
    summaryFilter: overlay.summaryFilter,
    floorMode: overlay.floorMode,
    paletteId: overlay.paletteId,
    color: overlay.color,
    scorecard,
    playerStats,
    fileSizeBytes: target.file.size > 0 ? target.file.size : undefined,
  };
}

/** Scorecard + player table for saved-notes list; keeps any existing drawings. */
export async function seedDemoStats(target: LoadedDemo): Promise<ReviewProject> {
  const key = matchKey(target.replay, target.fileName);
  const existing = await loadProject(key);
  const endTick = matchEndTick(target.replay);
  return {
    schema: PROJECT_SCHEMA,
    key,
    savedAt: Date.now(),
    fileName: target.fileName,
    mapName: target.replay.header.map_name,
    tick: existing?.tick ?? 0,
    strokes: existing?.strokes ?? [],
    summaryFilter: existing?.summaryFilter ?? DEFAULT_SUMMARY_FILTER,
    floorMode: existing?.floorMode ?? "auto",
    paletteId: existing?.paletteId ?? defaultPaletteId(),
    color: existing?.color ?? defaultColor(),
    scorecard: matchScorecard(target.replay, endTick),
    playerStats: savedPlayerSnapshots(target.replay, endTick),
    fileSizeBytes: target.file.size > 0 ? target.file.size : undefined,
  };
}

/** In-memory series review entries → IndexedDB, then clear the cache. */
export async function flushSeriesReviewCache(): Promise<void> {
  for (const entry of seriesReviewEntries()) {
    const endTick = matchEndTick(entry.demo.replay);
    await saveProject({
      schema: PROJECT_SCHEMA,
      key: matchKey(entry.demo.replay, entry.demo.fileName),
      savedAt: Date.now(),
      fileName: entry.demo.fileName,
      mapName: entry.demo.replay.header.map_name,
      tick: entry.tick,
      strokes: entry.strokes,
      summaryFilter: entry.summaryFilter,
      floorMode: entry.floorMode,
      paletteId: entry.paletteId,
      color: entry.color,
      scorecard: matchScorecard(entry.demo.replay, endTick),
      playerStats: savedPlayerSnapshots(entry.demo.replay, endTick),
      fileSizeBytes: entry.demo.file.size > 0 ? entry.demo.file.size : undefined,
    });
  }
  clearSeriesReviewCache();
}

export function reviewSnapshot(
  demo: LoadedDemo,
  tick: number,
  strokes: Stroke[],
  overlay: ReviewOverlay,
): SeriesReviewSnapshot {
  return {
    demo,
    tick,
    strokes,
    summaryFilter: overlay.summaryFilter,
    floorMode: overlay.floorMode,
    paletteId: overlay.paletteId,
    color: overlay.color,
  };
}
