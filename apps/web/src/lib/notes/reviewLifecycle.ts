import { getSeriesReview, setSeriesReview, type SeriesReviewSnapshot } from "./seriesReviewCache";

/** Pure enter / leave / stash / restore plans for `useReviewProject`. */

export type ReviewLifecycleEvent =
  "demo-enter" | "demo-leave" | "series-stash" | "series-restore" | "persist";

export interface DemoEnterClear {
  clearStrokes: boolean;
  resetOverlay: boolean;
}

/**
 * First load and non-series file changes wipe the canvas before restore.
 * A series hop keeps the outgoing strokes on screen until stash/restore.
 */
export function demoEnterClear(input: {
  prevDemoId: string | null;
  nextDemoId: string;
  hasSeries: boolean;
}): DemoEnterClear {
  const switchingSeries =
    input.hasSeries && input.prevDemoId != null && input.prevDemoId !== input.nextDemoId;
  if (switchingSeries || input.prevDemoId === input.nextDemoId) {
    return { clearStrokes: false, resetOverlay: false };
  }
  return { clearStrokes: true, resetOverlay: true };
}

export interface RestorePlan {
  source: "cache" | "idb";
  jumpTick: boolean;
  autoplayIfEmpty: boolean;
  pauseOnRestore: boolean;
  noticeOnRestore: boolean;
  persistOutgoingOnLeave: boolean;
  /** Series hop with no stash: allow debounce before IDB returns. */
  markRestoredImmediately: boolean;
}

export function restorePlan(input: {
  prevDemoId: string | null;
  demoId: string;
  inSeries: boolean;
  hasCache: boolean;
}): RestorePlan {
  const isSwitch = input.prevDemoId != null && input.prevDemoId !== input.demoId;
  if (input.hasCache) {
    return {
      source: "cache",
      jumpTick: false,
      autoplayIfEmpty: false,
      pauseOnRestore: false,
      noticeOnRestore: false,
      persistOutgoingOnLeave: false,
      markRestoredImmediately: false,
    };
  }
  if (input.inSeries && isSwitch) {
    return {
      source: "idb",
      jumpTick: false,
      autoplayIfEmpty: false,
      pauseOnRestore: true,
      noticeOnRestore: false,
      persistOutgoingOnLeave: false,
      markRestoredImmediately: true,
    };
  }
  return {
    source: "idb",
    jumpTick: true,
    autoplayIfEmpty: !isSwitch,
    pauseOnRestore: true,
    noticeOnRestore: true,
    persistOutgoingOnLeave: !input.inSeries,
    markRestoredImmediately: false,
  };
}

export function shouldDebouncePersist(input: { hasDemo: boolean; restored: boolean }): boolean {
  return input.hasDemo && input.restored;
}

/**
 * Hopping files in a series cancels the outgoing debounce. Drawings live in
 * the series cache until the series ends — they must be stashed first.
 */
export function seriesHopMidDebounce(): {
  event: ReviewLifecycleEvent;
  cancelDebounce: true;
  persistOutgoing: false;
  requireStash: true;
} {
  return {
    event: "series-stash",
    cancelDebounce: true,
    persistOutgoing: false,
    requireStash: true,
  };
}

export function shouldFlushSeriesCache(hasSeries: boolean): boolean {
  return !hasSeries;
}

export function stashSeriesReview(snapshot: SeriesReviewSnapshot): void {
  setSeriesReview(snapshot);
}

export function takeSeriesReview(demoId: string): SeriesReviewSnapshot | undefined {
  return getSeriesReview(demoId);
}
