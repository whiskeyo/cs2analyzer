/**
 * Lazy entry points so tutorial fixtures stay off the Analyzer cold path.
 *
 * `single-demo/` is a two-round Replay, `multi-demo/` is the Aggregated series,
 * `playbook/` is a sample book (habits snapshot + hand-drawn strat).
 */

import type { DemoSeries } from "@/lib/parse/session";
import type { Playbook } from "@/lib/playbook/types";
import type { Replay } from "@/lib/replay/replayTypes";
import { seriesMatchLoaders } from "./multi-demo/loaders";
import { getTutorialPlaybookLive, resetTutorialPlaybookLive } from "./playbook/live";
import { resetTutorialSeriesWarmup } from "./seriesWarmup";

let replayLoad: Promise<Replay> | null = null;
let seriesLoad: Promise<DemoSeries | null> | null = null;
let playbookLoad: Promise<Playbook> | null = null;
let seriesReady = false;
let seriesValue: DemoSeries | null = null;

/** Test hook: drop in-flight fixture promises so cases stay isolated. */
export function resetTutorialLoadCache(): void {
  replayLoad = null;
  seriesLoad = null;
  playbookLoad = null;
  seriesReady = false;
  seriesValue = null;
  resetTutorialSeriesWarmup();
  resetTutorialPlaybookLive();
}

/** True after `loadTutorialSeries()` has resolved (cache hit for Aggregated). */
export function isTutorialSeriesReady(): boolean {
  return seriesReady;
}

/** Resolved series object, or null until hydrate finishes (and after reset). */
export function peekTutorialSeries(): DemoSeries | null {
  return seriesValue;
}

/**
 * Kick match payload chunks without waiting for `hydrate.ts`. Vite splits each
 * match; starting them here overlaps download with Replay hydrate.
 */
export function prefetchTutorialSeriesChunks(): void {
  for (const load of Object.values(seriesMatchLoaders)) {
    void load();
  }
}

export function loadTutorialReplay(): Promise<Replay> {
  replayLoad ??= import("./single-demo/hydrate")
    .then(({ hydrateTutorialReplay }) => hydrateTutorialReplay())
    .catch((err: unknown) => {
      replayLoad = null;
      throw err;
    });
  return replayLoad;
}

export function loadTutorialSeries(): Promise<DemoSeries | null> {
  prefetchTutorialSeriesChunks();
  seriesLoad ??= import("./multi-demo/hydrate")
    .then(({ hydrateTutorialSeries }) => hydrateTutorialSeries())
    .then((series) => {
      seriesReady = true;
      seriesValue = series;
      return series;
    })
    .catch((err: unknown) => {
      seriesLoad = null;
      seriesReady = false;
      seriesValue = null;
      throw err;
    });
  return seriesLoad;
}

export function loadTutorialPlaybook(): Promise<Playbook> {
  playbookLoad ??= Promise.resolve(getTutorialPlaybookLive());
  return playbookLoad;
}
