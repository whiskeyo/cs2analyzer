import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import type { LoadedDemo, DemoSeries } from "@/lib/parse/session";
import type { Playback } from "@/lib/playback/usePlayback";
import type { Status } from "@/lib/state/status";
import type { SeriesReviewSnapshot } from "./seriesReviewCache";
import {
  demoEnterClear,
  restorePlan,
  shouldDebouncePersist,
  shouldFlushSeriesCache,
  stashSeriesReview,
  takeSeriesReview,
} from "./reviewLifecycle";
import {
  defaultColor,
  defaultPaletteId,
  loadAllProjects,
  loadProject,
  matchKey,
  saveProject,
  type ReviewProject,
} from "./projectStore";
import { flattenRoundNotes } from "./migrate";
import { DEFAULT_SUMMARY_FILTER, type FloorMode, type SummaryFilter } from "./types";
import { useStrokeHistory } from "./reviewHistory";
import {
  exportSavedNotes,
  importNotesFromText,
  linkDemoFile,
  removeAllSavedNotes,
  tryOpenLinkedDemo,
} from "./reviewImportExport";
import {
  applyPendingDemoLink,
  flushSeriesReviewCache,
  projectFromDemo,
  reviewSnapshot,
  seedDemoStats,
} from "./reviewPersistence";

/**
 * Owns the review of the loaded demo: drawings, their undo history, the
 * persisted overlay settings, and the saved-project list.
 *
 * Loading a demo restores its saved review if there is one (and pauses on the
 * saved tick); leaving a demo saves it. Nothing outside this hook has to know
 * when a project is written.
 */
export function useReviewProject(opts: {
  demo: LoadedDemo | null;
  series: DemoSeries | null;
  /** All demos from a multi-file drop (every map); used to seed saved notes. */
  parsedDemos: LoadedDemo[];
  status: Status;
  playback: Playback;
}) {
  const { demo, series, parsedDemos, status, playback } = opts;
  const [saved, setSaved] = useState<ReviewProject[]>([]);
  const { strokes, strokesRef, canUndo, canRedo, commitStrokes, undo, redo } = useStrokeHistory();
  const [paletteId, setPaletteId] = useState(defaultPaletteId);
  const [color, setColor] = useState(defaultColor);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(DEFAULT_SUMMARY_FILTER);
  const [floorMode, setFloorMode] = useState<FloorMode>("auto");
  const demoRef = useRef(demo);
  demoRef.current = demo;
  /** Previous demo id — used to detect series file switches vs first load. */
  const prevDemoIdRef = useRef<string | null>(null);
  const overlayRef = useRef({ summaryFilter, floorMode, paletteId, color });
  overlayRef.current = { summaryFilter, floorMode, paletteId, color };
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const statusRef = useRef(status);
  statusRef.current = status;
  /** Blocks the debounced save until a restore attempt has settled. */
  const restoredRef = useRef(false);

  const refreshSaved = useCallback(() => {
    void loadAllProjects()
      .then((list) => {
        list.sort((a, b) => b.savedAt - a.savedAt);
        setSaved(list);
      })
      .catch(() => undefined);
  }, []);

  const applySnapshot = useCallback(
    (snap: SeriesReviewSnapshot, jumpTick: boolean) => {
      commitStrokes(snap.strokes, true);
      setSummaryFilter(snap.summaryFilter);
      setFloorMode(snap.floorMode);
      setPaletteId(snap.paletteId);
      setColor(snap.color);
      if (jumpTick && snap.tick > 0) {
        playbackRef.current.jump(snap.tick, true);
      }
    },
    [commitStrokes],
  );

  const applyProject = useCallback(
    (p: ReviewProject, jumpTick: boolean) => {
      commitStrokes(flattenRoundNotes(p.notes), true);
      setSummaryFilter(p.summaryFilter);
      setFloorMode(p.floorMode);
      setPaletteId(p.paletteId);
      setColor(p.color);
      if (jumpTick && p.tick > 0) {
        playbackRef.current.jump(p.tick, true);
      }
    },
    [commitStrokes],
  );

  const snapshotNow = useCallback((): SeriesReviewSnapshot | null => {
    const target = demoRef.current;
    if (!target) {
      return null;
    }
    return reviewSnapshot(
      target,
      playbackRef.current.tickRef.current,
      strokesRef.current,
      overlayRef.current,
    );
  }, [strokesRef]);

  const exportNotes = useCallback(async () => {
    await exportSavedNotes(loadAllProjects, statusRef.current);
  }, []);

  const removeAllNotes = useCallback(async () => {
    await removeAllSavedNotes(refreshSaved, statusRef.current);
  }, [refreshSaved]);

  const importNotesText = useCallback(
    async (text: string) => {
      await importNotesFromText(text, {
        demo: demoRef.current,
        applyProject,
        refreshSaved,
        status: statusRef.current,
      });
    },
    [applyProject, refreshSaved],
  );

  const persist = useCallback(
    async (target: LoadedDemo | null, opts?: { stats?: boolean; refreshList?: boolean }) => {
      if (!target) {
        return;
      }
      const key = matchKey(target.replay, target.fileName);
      const existing = await loadProject(key);
      await saveProject(
        await applyPendingDemoLink(
          projectFromDemo(
            target,
            playbackRef.current.tickRef.current,
            strokesRef.current,
            overlayRef.current,
            existing,
            { withStats: opts?.stats !== false },
          ),
        ),
      );
      if (opts?.refreshList !== false) {
        refreshSaved();
      }
    },
    [refreshSaved, strokesRef],
  );

  const seededPoolRef = useRef<string | null>(null);

  /** Save the demo currently on screen, e.g. before the tab closes. */
  const persistNow = useCallback(() => persist(demoRef.current).catch(() => undefined), [persist]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // After a multi-file parse, snapshot scorecard + player stats for every demo (all maps).
  useEffect(() => {
    if (parsedDemos.length === 0) {
      seededPoolRef.current = null;
      return;
    }
    const key = parsedDemos.map((d) => d.id).join("\0");
    if (seededPoolRef.current === key) {
      return;
    }
    seededPoolRef.current = key;
    let cancelled = false;
    void (async () => {
      for (const d of parsedDemos) {
        if (cancelled) {
          return;
        }
        await saveProject(await seedDemoStats(d));
      }
      if (!cancelled) {
        refreshSaved();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsedDemos, refreshSaved]);

  // Drop the outgoing demo's drawings before a new one paints — except series hops.
  useLayoutEffect(() => {
    if (!demo?.id) {
      return;
    }
    restoredRef.current = false;
    const enter = demoEnterClear({
      prevDemoId: prevDemoIdRef.current,
      nextDemoId: demo.id,
      hasSeries: series != null,
    });
    if (!enter.clearStrokes) {
      return;
    }
    commitStrokes([], true);
    if (enter.resetOverlay) {
      setSummaryFilter(DEFAULT_SUMMARY_FILTER);
      setFloorMode("auto");
    }
  }, [demo?.id, series, commitStrokes]);

  /** Call before swapping the active file in a series (refs still point at the outgoing demo). */
  const stashForSeriesSwitch = useCallback(() => {
    const snap = snapshotNow();
    if (snap) {
      stashSeriesReview(snap);
    }
  }, [snapshotNow]);

  // Restore this demo's review on load, and save it again on the way out.
  useEffect(() => {
    if (!demo) {
      prevDemoIdRef.current = null;
      return;
    }
    const prevDemoId = prevDemoIdRef.current;
    prevDemoIdRef.current = demo.id;
    let cancelled = false;

    const inSeries = series?.demos.some((d) => d.id === demo.id) ?? false;
    const cached = inSeries ? takeSeriesReview(demo.id) : undefined;
    const plan = restorePlan({
      prevDemoId,
      demoId: demo.id,
      inSeries,
      hasCache: cached != null,
    });

    if (plan.source === "cache" && cached) {
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        applySnapshot(cached, plan.jumpTick);
        restoredRef.current = true;
      });
      return () => {
        cancelled = true;
      };
    }

    if (plan.markRestoredImmediately) {
      restoredRef.current = true;
    }

    const settle = (project: ReviewProject | null) => {
      if (cancelled) {
        return;
      }
      restoredRef.current = true;
      if (!project) {
        if (plan.autoplayIfEmpty) {
          playbackRef.current.setPlaying(true);
        }
        return;
      }
      applyProject(project, plan.jumpTick);
      if (plan.pauseOnRestore) {
        playbackRef.current.setPlaying(false);
      }
      if (plan.noticeOnRestore) {
        statusRef.current.setNotice((prev) =>
          prev ? `${prev}. Restored drawings for this match.` : "Restored drawings for this match.",
        );
      }
    };
    void loadProject(matchKey(demo.replay, demo.fileName))
      .then(settle)
      .catch(() => settle(null));
    return () => {
      cancelled = true;
      if (plan.persistOutgoingOnLeave) {
        void persist(demo, { stats: false, refreshList: false }).catch(() => undefined);
      }
    };
  }, [demo, series, applyProject, applySnapshot, persist]);

  useEffect(() => {
    if (!shouldFlushSeriesCache(series != null)) {
      return;
    }
    void flushSeriesReviewCache().catch(() => undefined);
  }, [series]);

  useEffect(() => {
    if (!shouldDebouncePersist({ hasDemo: demo != null, restored: restoredRef.current })) {
      return;
    }
    const id = window.setTimeout(() => {
      void persistNow();
    }, PROJECT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [demo, playback.playing, strokes, summaryFilter, floorMode, paletteId, color, persistNow]);

  useEffect(() => {
    const onUnload = () => {
      void persistNow();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [persistNow]);

  const tryOpenSaved = useCallback(
    async (project: ReviewProject) => tryOpenLinkedDemo(project, statusRef.current),
    [],
  );

  const linkDemoFileForProject = useCallback(
    async (project: ReviewProject) => {
      await linkDemoFile(project, refreshSaved, statusRef.current);
    },
    [refreshSaved],
  );

  return {
    saved,
    strokes,
    strokesRef,
    canUndo,
    canRedo,
    paletteId,
    setPaletteId,
    color,
    setColor,
    summaryFilter,
    setSummaryFilter,
    floorMode,
    setFloorMode,
    refreshSaved,
    commitStrokes,
    undo,
    redo,
    applyProject,
    exportNotes,
    importNotesText,
    removeAllNotes,
    persistNow,
    stashForSeriesSwitch,
    tryOpenSaved,
    linkDemoFile: linkDemoFileForProject,
  };
}

export type ReviewSession = ReturnType<typeof useReviewProject>;
