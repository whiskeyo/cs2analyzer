/**
 * Off-path Aggregated install prep: tagged series + full-buy overlays.
 *
 * Hydrate (`loadTutorialSeries`) can finish while `/tutorial/single` is still on
 * Mirage. Building trails then, after first paint, keeps Next from doing that
 * CPU on the main thread during the session swap.
 */

import { calibrationFor, loadCalibrations, radarUrl } from "@/lib/radar/maps";
import { loadMapLayout } from "@/lib/radar/layouts";
import {
  buildSeriesOverlay,
  clampSeriesTrailWindowSec,
  type SeriesOverlay,
} from "@/lib/parse/seriesOverlay";
import { clampPathBranchOptions, type PathBranchOptions } from "@/lib/parse/pathBranches";
import type { DemoSeries } from "@/lib/parse/session";
import type { SeriesFilter } from "@/lib/parse/seriesAnalysis";
import type { Side } from "@/lib/replay/replayTypes";
import { SERIES_HABITS_WINDOW_SECONDS } from "@/lib/shared/constants";
import { tutorialSeriesHabitsTags } from "./activeRound";

export interface TutorialSeriesPrewarmOpts {
  trailWindowSec?: number;
  mergeDistance?: number;
  stepDistance?: number;
  minShare?: number;
}

const PREWARM_SIDES: readonly Side[] = ["CT", "T"];

let prewarmSeries: DemoSeries | null = null;
let taggedSeries: DemoSeries | null = null;
let overlayReady = false;
let storedOptsKey = "";
const overlays = new Map<string, SeriesOverlay>();
let inFlight: Promise<void> | null = null;
let resolveInFlight: (() => void) | null = null;
let cancelScheduled: (() => void) | null = null;

function optsKey(opts?: TutorialSeriesPrewarmOpts): string {
  const branch = clampPathBranchOptions({
    mergeDistance: opts?.mergeDistance,
    stepDistance: opts?.stepDistance,
    minShare: opts?.minShare,
  });
  const windowSec = clampSeriesTrailWindowSec(opts?.trailWindowSec ?? SERIES_HABITS_WINDOW_SECONDS);
  return `${windowSec}|${branch.mergeDistance}|${branch.stepDistance}|${branch.minShare}`;
}

function overlayCacheKey(
  filter: SeriesFilter,
  playerKey: string | null,
  windowSec: number,
  branch: PathBranchOptions,
): string {
  return `${filter.side ?? "CT"}|${filter.kind ?? "full"}|${playerKey ?? ""}|${windowSec}|${branch.mergeDistance}|${branch.stepDistance}|${branch.minShare}`;
}

function finishFlight(): void {
  overlayReady = true;
  resolveInFlight?.();
  resolveInFlight = null;
}

function beginFlight(): Promise<void> {
  inFlight = new Promise((resolve) => {
    resolveInFlight = resolve;
  });
  return inFlight;
}

function cancelPaintWait(): void {
  cancelScheduled?.();
  cancelScheduled = null;
}

function afterFirstPaint(run: () => void): () => void {
  let cancelled = false;
  let timeoutId = 0;
  const start = (): void => {
    if (cancelled) return;
    timeoutId = window.setTimeout(() => {
      if (!cancelled) run();
    }, 0);
  };
  let raf = 0;
  if (typeof requestAnimationFrame === "function") {
    raf = requestAnimationFrame(start);
  } else {
    start();
  }
  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    if (timeoutId) window.clearTimeout(timeoutId);
  };
}

function prefetchSeriesMapAssets(mapName: string): void {
  void loadMapLayout(mapName).catch(() => undefined);
  void loadCalibrations()
    .then((maps) => {
      const cal = calibrationFor(maps, mapName);
      if (!cal || typeof Image === "undefined") return;
      const upper = new Image();
      upper.src = radarUrl(cal.radar);
      if (cal.lower_radar) {
        const lower = new Image();
        lower.src = radarUrl(cal.lower_radar);
      }
    })
    .catch(() => undefined);
}

function prewarmNow(series: DemoSeries, opts?: TutorialSeriesPrewarmOpts): void {
  const branch = clampPathBranchOptions({
    mergeDistance: opts?.mergeDistance,
    stepDistance: opts?.stepDistance,
    minShare: opts?.minShare,
  });
  const windowSec = clampSeriesTrailWindowSec(opts?.trailWindowSec ?? SERIES_HABITS_WINDOW_SECONDS);
  const tagsByDemo = tutorialSeriesHabitsTags(series);
  taggedSeries = tagsByDemo === series.tagsByDemo ? series : { ...series, tagsByDemo };
  overlays.clear();
  for (const side of PREWARM_SIDES) {
    const filter: SeriesFilter = { side, kind: "full" };
    const overlay = buildSeriesOverlay(taggedSeries, filter, null, windowSec, branch);
    overlays.set(overlayCacheKey(filter, null, windowSec, branch), overlay);
  }
  prewarmSeries = series;
  storedOptsKey = optsKey(opts);
  overlayReady = true;
  prefetchSeriesMapAssets(series.mapName);
}

/** Test hook: drop tagged overlay handles so cases stay isolated. */
export function resetTutorialSeriesWarmup(): void {
  cancelPaintWait();
  prewarmSeries = null;
  taggedSeries = null;
  overlayReady = false;
  storedOptsKey = "";
  overlays.clear();
  inFlight = null;
  resolveInFlight = null;
}

export function isTutorialSeriesOverlayReady(): boolean {
  return overlayReady && prewarmSeries != null;
}

export function peekTutorialTaggedSeries(series: DemoSeries): DemoSeries | null {
  return prewarmSeries === series ? taggedSeries : null;
}

export function peekTutorialSeriesOverlay(
  series: DemoSeries,
  filter: SeriesFilter,
  playerKey: string | null,
  windowSec: number,
  branch?: Partial<PathBranchOptions>,
): SeriesOverlay | null {
  if (prewarmSeries !== series) return null;
  const clampedWindow = clampSeriesTrailWindowSec(windowSec);
  const clampedBranch = clampPathBranchOptions(branch);
  return overlays.get(overlayCacheKey(filter, playerKey, clampedWindow, clampedBranch)) ?? null;
}

function rememberOverlay(
  series: DemoSeries,
  filter: SeriesFilter,
  playerKey: string | null,
  windowSec: number,
  branch: PathBranchOptions,
  overlay: SeriesOverlay,
): void {
  if (prewarmSeries !== series) return;
  overlays.set(overlayCacheKey(filter, playerKey, windowSec, branch), overlay);
}

/** Cache-aware overlay for the tutorial series (hit on Next when prewarm finished). */
export function tutorialSeriesOverlay(
  series: DemoSeries,
  overlaySeries: DemoSeries,
  filter: SeriesFilter,
  playerKey: string | null,
  windowSec: number,
  branch?: Partial<PathBranchOptions>,
): SeriesOverlay {
  const clampedWindow = clampSeriesTrailWindowSec(windowSec);
  const clampedBranch = clampPathBranchOptions(branch);
  const hit = peekTutorialSeriesOverlay(series, filter, playerKey, clampedWindow, clampedBranch);
  if (hit) return hit;
  const overlay = buildSeriesOverlay(
    overlaySeries,
    filter,
    playerKey,
    clampedWindow,
    clampedBranch,
  );
  rememberOverlay(series, filter, playerKey, clampedWindow, clampedBranch, overlay);
  return overlay;
}

/**
 * After Mirage first paint: build full CT/T overlays + Dust II layout/radar.
 * No-op when this series is already prewarmed.
 */
export function scheduleTutorialSeriesPrewarm(
  series: DemoSeries,
  opts?: TutorialSeriesPrewarmOpts,
): void {
  const key = optsKey(opts);
  if (overlayReady && prewarmSeries === series && storedOptsKey === key) return;
  if (inFlight && prewarmSeries === series && storedOptsKey === key && cancelScheduled) return;
  cancelPaintWait();
  overlayReady = false;
  prewarmSeries = series;
  storedOptsKey = key;
  beginFlight();
  cancelScheduled = afterFirstPaint(() => {
    cancelScheduled = null;
    prewarmNow(series, opts);
    finishFlight();
  });
}

/**
 * Run (or flush) overlay prep now. Used on Aggregated navigation so Next waits
 * under the loading notice instead of hitching the radar after install.
 */
export function ensureTutorialSeriesPrewarm(
  series: DemoSeries,
  opts?: TutorialSeriesPrewarmOpts,
): Promise<void> {
  const key = optsKey(opts);
  if (overlayReady && prewarmSeries === series && storedOptsKey === key) {
    return Promise.resolve();
  }
  if (inFlight && prewarmSeries === series && storedOptsKey === key) {
    if (cancelScheduled) {
      cancelPaintWait();
      prewarmNow(series, opts);
      finishFlight();
    }
    return inFlight;
  }
  cancelPaintWait();
  overlayReady = false;
  prewarmSeries = series;
  storedOptsKey = key;
  prewarmNow(series, opts);
  inFlight = Promise.resolve();
  return inFlight;
}
