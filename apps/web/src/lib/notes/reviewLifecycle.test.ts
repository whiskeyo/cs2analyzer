import { describe, expect, it } from "vitest";
import {
  demoEnterClear,
  restorePlan,
  seriesHopMidDebounce,
  shouldDebouncePersist,
  shouldFlushSeriesCache,
} from "./reviewLifecycle";

describe("reviewLifecycle", () => {
  it("clears the canvas on first enter and on a non-series demo change", () => {
    expect(demoEnterClear({ prevDemoId: null, nextDemoId: "a", hasSeries: false })).toEqual({
      clearStrokes: true,
      resetOverlay: true,
    });
    expect(demoEnterClear({ prevDemoId: "a", nextDemoId: "b", hasSeries: false })).toEqual({
      clearStrokes: true,
      resetOverlay: true,
    });
  });

  it("does not jump or re-announce when the same demo stays mounted", () => {
    const same = restorePlan({
      prevDemoId: "a",
      demoId: "a",
      inSeries: true,
      hasCache: false,
    });
    expect(same.jumpTick).toBe(false);
    expect(same.noticeOnRestore).toBe(false);
    expect(same.autoplayIfEmpty).toBe(false);
    expect(same.markRestoredImmediately).toBe(true);
    expect(same.persistOutgoingOnLeave).toBe(false);
  });

  it("does not wipe overlay again while the same demo stays mounted", () => {
    expect(demoEnterClear({ prevDemoId: "a", nextDemoId: "a", hasSeries: false })).toEqual({
      clearStrokes: false,
      resetOverlay: false,
    });
  });

  it("keeps strokes on screen during a series hop until stash/restore", () => {
    expect(demoEnterClear({ prevDemoId: "a", nextDemoId: "b", hasSeries: true })).toEqual({
      clearStrokes: false,
      resetOverlay: false,
    });
  });

  it("restores a series stash from cache without jumping or persisting on leave", () => {
    expect(
      restorePlan({
        prevDemoId: "a",
        demoId: "b",
        inSeries: true,
        hasCache: true,
      }),
    ).toEqual({
      source: "cache",
      jumpTick: false,
      autoplayIfEmpty: false,
      pauseOnRestore: false,
      noticeOnRestore: false,
      persistOutgoingOnLeave: false,
      markRestoredImmediately: false,
    });
  });

  it("loads IDB on a series hop without a stash and does not persist the outgoing demo", () => {
    const plan = restorePlan({
      prevDemoId: "a",
      demoId: "b",
      inSeries: true,
      hasCache: false,
    });
    expect(plan.source).toBe("idb");
    expect(plan.persistOutgoingOnLeave).toBe(false);
    expect(plan.jumpTick).toBe(false);
    expect(plan.noticeOnRestore).toBe(false);
    expect(seriesHopMidDebounce()).toEqual({
      event: "series-stash",
      cancelDebounce: true,
      persistOutgoing: false,
      requireStash: true,
    });
  });

  it("persists a standalone demo on leave and autoplays when there is nothing to restore", () => {
    expect(
      restorePlan({
        prevDemoId: null,
        demoId: "a",
        inSeries: false,
        hasCache: false,
      }),
    ).toMatchObject({
      source: "idb",
      jumpTick: true,
      autoplayIfEmpty: true,
      persistOutgoingOnLeave: true,
      noticeOnRestore: true,
    });
  });

  it("only debounces persist after restore has settled", () => {
    expect(shouldDebouncePersist({ hasDemo: true, restored: false })).toBe(false);
    expect(shouldDebouncePersist({ hasDemo: true, restored: true })).toBe(true);
    expect(
      shouldDebouncePersist({
        hasDemo: true,
        restored: true,
        persistable: false,
      }),
    ).toBe(false);
  });

  it("does not persist notes that still belong to another demo", () => {
    expect(
      shouldDebouncePersist({
        hasDemo: true,
        restored: true,
        notesDemoId: "a",
        boardDemoId: "b",
      }),
    ).toBe(false);
    expect(
      shouldDebouncePersist({
        hasDemo: true,
        restored: true,
        notesDemoId: "b",
        boardDemoId: "b",
      }),
    ).toBe(true);
    expect(
      shouldDebouncePersist({
        hasDemo: true,
        restored: true,
        notesDemoId: null,
        boardDemoId: "b",
      }),
    ).toBe(false);
  });

  it("flushes the series cache when the series identity goes away", () => {
    expect(shouldFlushSeriesCache(true)).toBe(false);
    expect(shouldFlushSeriesCache(false)).toBe(true);
  });
});
