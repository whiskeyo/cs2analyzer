import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import { isTutorialDemoId, isTutorialLoadedDemo } from "@/lib/tutorial/identity";
import type { LoadedDemo, DemoSeries } from "@/lib/parse/session";
import type { Playback } from "@/lib/playback/usePlayback";
import type { Status } from "@/lib/state/status";
import { reportQuotaError } from "@/lib/storage/quota";
import type { SeriesReviewSnapshot } from "./seriesReviewCache";
import {
  demoEnterClear,
  notesBelongToDemo,
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
import { DEFAULT_SUMMARY_FILTER, type FloorMode, type SummaryFilter } from "./types";
import { useRoundNoteHistory } from "./reviewHistory";
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
  overlayIsUnset,
  projectFromDemo,
  reviewSnapshot,
  seedDemoStats,
  type ReviewOverlay,
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
  /** Global defaults for a demo with no saved project. */
  overlayDefaults?: ReviewOverlay;
  /**
   * Shell-owned saved-notes list. When set, persist/seed/refresh write that
   * copy so Home → Analyzer still sees rows after AnalyzerRuntime unmounts.
   */
  saved?: ReviewProject[];
  refreshSaved?: () => void;
}) {
  const { demo, series, parsedDemos, status, playback } = opts;
  const overlayDefaultsRef = useRef<ReviewOverlay>({
    paletteId: defaultPaletteId(),
    color: defaultColor(),
    floorMode: "auto",
    summaryFilter: DEFAULT_SUMMARY_FILTER,
  });
  overlayDefaultsRef.current = opts.overlayDefaults ?? overlayDefaultsRef.current;
  const [localSaved, setLocalSaved] = useState<ReviewProject[]>([]);
  const { notes, notesRef, canUndo, canRedo, commitNotes, undo, redo } = useRoundNoteHistory();
  const notesDemoIdRef = useRef<string | null>(null);
  const [notesDemoId, setNotesDemoIdState] = useState<string | null>(null);
  const setNotesDemoId = useCallback((id: string | null) => {
    notesDemoIdRef.current = id;
    setNotesDemoIdState(id);
  }, []);
  const [paletteId, setPaletteId] = useState(overlayDefaultsRef.current.paletteId);
  const [color, setColor] = useState(overlayDefaultsRef.current.color);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(
    overlayDefaultsRef.current.summaryFilter,
  );
  const [floorMode, setFloorMode] = useState<FloorMode>(overlayDefaultsRef.current.floorMode);
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

  const localRefreshSaved = useCallback(() => {
    void loadAllProjects()
      .then((list) => {
        list.sort((a, b) => b.savedAt - a.savedAt);
        setLocalSaved(list);
      })
      .catch(() => undefined);
  }, []);
  const refreshSaved = opts.refreshSaved ?? localRefreshSaved;
  const saved = opts.saved ?? localSaved;

  const applySnapshot = useCallback(
    (snap: SeriesReviewSnapshot, jumpTick: boolean) => {
      commitNotes(snap.notes, true);
      setNotesDemoId(snap.demo.id);
      setSummaryFilter(snap.summaryFilter);
      setFloorMode(snap.floorMode);
      setPaletteId(snap.paletteId);
      setColor(snap.color);
      if (jumpTick && snap.tick > 0) {
        playbackRef.current.jump(snap.tick, true);
      }
    },
    [commitNotes, setNotesDemoId],
  );

  const applyProject = useCallback(
    (p: ReviewProject, jumpTick: boolean) => {
      commitNotes(p.notes, true);
      setNotesDemoId(demoRef.current?.id ?? null);
      setSummaryFilter(p.summaryFilter);
      setFloorMode(p.floorMode);
      setPaletteId(p.paletteId);
      setColor(p.color);
      if (jumpTick && p.tick > 0) {
        playbackRef.current.jump(p.tick, true);
      }
    },
    [commitNotes, setNotesDemoId],
  );

  const commitOwnedNotes = useCallback(
    (next: Parameters<typeof commitNotes>[0], reset = false) => {
      commitNotes(next, reset);
      setNotesDemoId(demoRef.current?.id ?? null);
    },
    [commitNotes, setNotesDemoId],
  );

  const snapshotNow = useCallback((): SeriesReviewSnapshot | null => {
    const target = demoRef.current;
    if (!target) {
      return null;
    }
    return reviewSnapshot(
      target,
      playbackRef.current.tickRef.current,
      notesRef.current,
      overlayRef.current,
    );
  }, [notesRef]);

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
      if (!target || isTutorialLoadedDemo(target)) {
        return;
      }
      if (!notesBelongToDemo(notesDemoIdRef.current, target.id)) {
        return;
      }
      const key = matchKey(target.replay, target.fileName);
      const existing = await loadProject(key);
      await saveProject(
        await applyPendingDemoLink(
          projectFromDemo(
            target,
            playbackRef.current.tickRef.current,
            notesRef.current,
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
    [refreshSaved, notesRef],
  );

  const seededPoolRef = useRef<string | null>(null);

  /** Save the demo currently on screen, e.g. before the tab closes. */
  const persistNow = useCallback(
    () =>
      persist(demoRef.current).catch((err) => {
        reportQuotaError(err, (message) => statusRef.current.setError(message));
      }),
    [persist],
  );

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
        if (isTutorialLoadedDemo(d)) {
          continue;
        }
        await saveProject(await seedDemoStats(d, overlayDefaultsRef.current));
      }
      if (!cancelled) {
        refreshSaved();
      }
    })().catch((err) => {
      if (!cancelled) {
        reportQuotaError(err, (message) => statusRef.current.setError(message));
      }
    });
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
    commitNotes([], true);
    setNotesDemoId(demo.id);
    if (enter.resetOverlay) {
      const defaults = overlayDefaultsRef.current;
      setSummaryFilter({
        ...defaults.summaryFilter,
        kinds: { ...defaults.summaryFilter.kinds },
      });
      setFloorMode(defaults.floorMode);
      setPaletteId(defaults.paletteId);
      setColor(defaults.color);
    }
  }, [demo?.id, series, commitNotes, setNotesDemoId]);

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
      if (!project || overlayIsUnset(project)) {
        if (!notesBelongToDemo(notesDemoIdRef.current, demo.id)) {
          commitNotes([], true);
        }
        setNotesDemoId(demo.id);
        if (plan.autoplayIfEmpty && !isTutorialLoadedDemo(demo)) {
          playbackRef.current.setPlaying(true);
        }
        return;
      }
      applyProject(project, plan.jumpTick);
      if (plan.pauseOnRestore) {
        playbackRef.current.setPlaying(false);
      }
      if (plan.noticeOnRestore && !isTutorialDemoId(demo.id)) {
        statusRef.current.setNotice((prev) =>
          prev ? `${prev}. Restored drawings for this match.` : "Restored drawings for this match.",
        );
      }
    };

    if (isTutorialLoadedDemo(demo)) {
      settle(null);
      return () => {
        cancelled = true;
      };
    }

    void loadProject(matchKey(demo.replay, demo.fileName))
      .then(settle)
      .catch(() => settle(null));
    return () => {
      cancelled = true;
      if (plan.persistOutgoingOnLeave) {
        void persist(demo, { stats: false, refreshList: false }).catch((err) => {
          reportQuotaError(err, (message) => statusRef.current.setError(message));
        });
      }
    };
  }, [demo, series, applyProject, applySnapshot, persist, commitNotes, setNotesDemoId]);

  useEffect(() => {
    if (!shouldFlushSeriesCache(series != null)) {
      return;
    }
    void flushSeriesReviewCache().catch(() => undefined);
  }, [series]);

  useEffect(() => {
    if (
      !shouldDebouncePersist({
        hasDemo: demo != null,
        restored: restoredRef.current,
        notesDemoId: notesDemoIdRef.current,
        boardDemoId: demo?.id ?? null,
        persistable: !isTutorialLoadedDemo(demo),
      })
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      void persistNow();
    }, PROJECT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [
    demo,
    playback.playing,
    notes,
    notesDemoId,
    summaryFilter,
    floorMode,
    paletteId,
    color,
    persistNow,
  ]);

  useEffect(() => {
    const onUnload = () => {
      void persistNow();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [persistNow]);

  const persistRef = useRef(persist);
  persistRef.current = persist;
  const snapshotNowRef = useRef(snapshotNow);
  snapshotNowRef.current = snapshotNow;
  const refreshSavedRef = useRef(refreshSaved);
  refreshSavedRef.current = refreshSaved;

  // Series hops skip persist-on-leave; closing the session unmounts this hook
  // without a series=null flush. Stash + write so IndexedDB matches RAM.
  useEffect(() => {
    return () => {
      if (!restoredRef.current) {
        return;
      }
      const snap = snapshotNowRef.current();
      if (snap) {
        stashSeriesReview(snap);
      }
      const target = demoRef.current;
      void (async () => {
        if (target) {
          await persistRef.current(target, {
            stats: false,
            refreshList: false,
          });
        }
        await flushSeriesReviewCache();
        refreshSavedRef.current();
      })().catch((err) => {
        reportQuotaError(err, (message) => statusRef.current.setError(message));
      });
    };
  }, []);

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
    notes,
    notesDemoId,
    notesRef,
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
    commitNotes: commitOwnedNotes,
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
