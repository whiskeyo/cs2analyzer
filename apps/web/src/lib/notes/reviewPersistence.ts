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
  pendingDemoFileHandle,
  PROJECT_SCHEMA,
  saveDemoFileHandle,
  saveProject,
  type ReviewProject,
} from "./projectStore";
import {
  DEFAULT_SUMMARY_FILTER,
  type FloorMode,
  type RoundNote,
  type SummaryFilter,
} from "./types";

export interface ReviewOverlay {
  summaryFilter: SummaryFilter;
  floorMode: FloorMode;
  paletteId: string;
  color: string;
}

export interface PersistReviewOpts {
  withStats?: boolean;
}

function withLinkedFileLabel(
  row: ReviewProject,
  existing: ReviewProject | null | undefined,
): ReviewProject {
  if (row.linkedFileLabel || !existing?.linkedFileLabel) return row;
  return { ...row, linkedFileLabel: existing.linkedFileLabel };
}

/** Bind a drop/picker file handle to saved notes when Chrome/Edge captured one. */
export async function applyPendingDemoLink(project: ReviewProject): Promise<ReviewProject> {
  const handle = pendingDemoFileHandle(project.fileName);
  if (!handle || handle.name !== project.fileName) return project;
  await saveDemoFileHandle(project.key, handle);
  return { ...project, linkedFileLabel: handle.name };
}

/** Build a saved-note row for IndexedDB (optionally refreshing scorecard stats). */
export function projectFromDemo(
  target: LoadedDemo,
  tick: number,
  notes: RoundNote[],
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
  return withLinkedFileLabel(
    {
      schema: PROJECT_SCHEMA,
      key: matchKey(target.replay, target.fileName),
      savedAt: Date.now(),
      fileName: target.fileName,
      mapName: target.replay.header.map_name,
      tick,
      notes,
      summaryFilter: overlay.summaryFilter,
      floorMode: overlay.floorMode,
      paletteId: overlay.paletteId,
      color: overlay.color,
      scorecard,
      playerStats,
      fileSizeBytes: target.file.size > 0 ? target.file.size : undefined,
    },
    existing,
  );
}

/** Scorecard + player table for saved-notes list; keeps any existing drawings. */
export async function seedDemoStats(
  target: LoadedDemo,
  overlayDefaults?: ReviewOverlay,
): Promise<ReviewProject> {
  const key = matchKey(target.replay, target.fileName);
  const existing = await loadProject(key);
  const endTick = matchEndTick(target.replay);
  return applyPendingDemoLink(
    withLinkedFileLabel(
      {
        schema: PROJECT_SCHEMA,
        key,
        savedAt: Date.now(),
        fileName: target.fileName,
        mapName: target.replay.header.map_name,
        tick: existing?.tick ?? 0,
        notes: existing?.notes ?? [],
        summaryFilter:
          existing?.summaryFilter ?? overlayDefaults?.summaryFilter ?? DEFAULT_SUMMARY_FILTER,
        floorMode: existing?.floorMode ?? overlayDefaults?.floorMode ?? "auto",
        paletteId: existing?.paletteId ?? overlayDefaults?.paletteId ?? defaultPaletteId(),
        color: existing?.color ?? overlayDefaults?.color ?? defaultColor(),
        scorecard: matchScorecard(target.replay, endTick),
        playerStats: savedPlayerSnapshots(target.replay, endTick),
        fileSizeBytes: target.file.size > 0 ? target.file.size : undefined,
      },
      existing,
    ),
  );
}

/** In-memory series review entries → IndexedDB, then clear the cache. */
export async function flushSeriesReviewCache(): Promise<void> {
  for (const entry of seriesReviewEntries()) {
    const endTick = matchEndTick(entry.demo.replay);
    const key = matchKey(entry.demo.replay, entry.demo.fileName);
    const existing = await loadProject(key);
    await saveProject(
      await applyPendingDemoLink(
        withLinkedFileLabel(
          {
            schema: PROJECT_SCHEMA,
            key,
            savedAt: Date.now(),
            fileName: entry.demo.fileName,
            mapName: entry.demo.replay.header.map_name,
            tick: entry.tick,
            notes: entry.notes,
            summaryFilter: entry.summaryFilter,
            floorMode: entry.floorMode,
            paletteId: entry.paletteId,
            color: entry.color,
            scorecard: matchScorecard(entry.demo.replay, endTick),
            playerStats: savedPlayerSnapshots(entry.demo.replay, endTick),
            fileSizeBytes: entry.demo.file.size > 0 ? entry.demo.file.size : undefined,
          },
          existing,
        ),
      ),
    );
  }
  clearSeriesReviewCache();
}

export function reviewSnapshot(
  demo: LoadedDemo,
  tick: number,
  notes: RoundNote[],
  overlay: ReviewOverlay,
): SeriesReviewSnapshot {
  return {
    demo,
    tick,
    notes,
    summaryFilter: overlay.summaryFilter,
    floorMode: overlay.floorMode,
    paletteId: overlay.paletteId,
    color: overlay.color,
  };
}
