import { matchEndTick, matchScorecard, savedPlayerSnapshots } from "@/lib/stats/stats";
import type { LoadedDemo } from "@/lib/parse/session";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
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

function summaryFiltersEqual(a: SummaryFilter, b: SummaryFilter): boolean {
  if (a.t !== b.t || a.ct !== b.ct) {
    return false;
  }
  const kinds = new Set([...Object.keys(a.kinds), ...Object.keys(b.kinds)]);
  for (const kind of kinds) {
    if (a.kinds[kind as GrenadeKind] !== b.kinds[kind as GrenadeKind]) {
      return false;
    }
  }
  return true;
}

/**
 * Scorecard-only rows (no drawings) still store shipped overlay defaults.
 * Those are not per-demo toolbar state — a later drop should pick up Preferences.
 */
export function overlayIsUnset(
  project: Pick<ReviewProject, "notes" | "summaryFilter" | "floorMode" | "paletteId" | "color">,
): boolean {
  if (project.notes.length > 0) {
    return false;
  }
  return (
    summaryFiltersEqual(project.summaryFilter, DEFAULT_SUMMARY_FILTER) &&
    project.floorMode === "auto" &&
    project.paletteId === defaultPaletteId() &&
    project.color === defaultColor()
  );
}

/** Overlay to persist on a stats seed: keep real per-demo edits, else Preferences. */
export function overlayForSeed(
  existing: ReviewProject | null | undefined,
  overlayDefaults?: ReviewOverlay,
): ReviewOverlay {
  if (existing && !overlayIsUnset(existing)) {
    return {
      summaryFilter: existing.summaryFilter,
      floorMode: existing.floorMode,
      paletteId: existing.paletteId,
      color: existing.color,
    };
  }
  return {
    summaryFilter: overlayDefaults?.summaryFilter ?? DEFAULT_SUMMARY_FILTER,
    floorMode: overlayDefaults?.floorMode ?? "auto",
    paletteId: overlayDefaults?.paletteId ?? defaultPaletteId(),
    color: overlayDefaults?.color ?? defaultColor(),
  };
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
  const overlay = overlayForSeed(existing, overlayDefaults);
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
        summaryFilter: overlay.summaryFilter,
        floorMode: overlay.floorMode,
        paletteId: overlay.paletteId,
        color: overlay.color,
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
