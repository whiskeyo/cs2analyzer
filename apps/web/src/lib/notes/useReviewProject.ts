import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DRAW_HISTORY_LIMIT, PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import { matchEndTick, matchScorecard, savedPlayerSnapshots } from "@/lib/stats/stats";
import type { LoadedDemo, DemoSeries } from "@/lib/parse/session";
import type { Playback } from "@/lib/playback/usePlayback";
import type { Status } from "@/lib/state/status";
import {
  clearSeriesReviewCache,
  getSeriesReview,
  seriesReviewEntries,
  setSeriesReview,
  type SeriesReviewSnapshot,
} from "./seriesReviewCache";
import {
  defaultColor,
  defaultPaletteId,
  deleteAllProjects,
  demoFilePickerAvailable,
  importProjects,
  loadAllProjects,
  loadProject,
  matchKey,
  parseBundle,
  pickDemoFileHandle,
  PROJECT_SCHEMA,
  readLinkedDemoFile,
  saveDemoFileHandle,
  saveProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";
import { DEFAULT_SUMMARY_FILTER, type FloorMode, type Stroke, type SummaryFilter } from "./types";

function downloadJson(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

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
  status: Status;
  playback: Playback;
}) {
  const { demo, series, status, playback } = opts;
  const [saved, setSaved] = useState<ReviewProject[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [paletteId, setPaletteId] = useState(defaultPaletteId);
  const [color, setColor] = useState(defaultColor);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(DEFAULT_SUMMARY_FILTER);
  const [floorMode, setFloorMode] = useState<FloorMode>("auto");
  const historyRef = useRef<Stroke[][]>([[]]);
  const histIdxRef = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
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

  const syncHistoryButtons = () => {
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  };

  const commitStrokes = useCallback((next: Stroke[], reset = false) => {
    if (reset) {
      historyRef.current = [next];
      histIdxRef.current = 0;
    } else {
      const trimmed = historyRef.current.slice(0, histIdxRef.current + 1);
      trimmed.push(next);
      if (trimmed.length > DRAW_HISTORY_LIMIT) trimmed.shift();
      historyRef.current = trimmed;
      histIdxRef.current = trimmed.length - 1;
    }
    setStrokes(next);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current -= 1;
    setStrokes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current += 1;
    setStrokes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, []);

  const applySnapshot = useCallback(
    (snap: SeriesReviewSnapshot, jumpTick: boolean) => {
      commitStrokes(snap.strokes, true);
      setSummaryFilter(snap.summaryFilter);
      setFloorMode(snap.floorMode);
      setPaletteId(snap.paletteId);
      setColor(snap.color);
      if (jumpTick && snap.tick > 0) playbackRef.current.jump(snap.tick, true);
    },
    [commitStrokes],
  );

  const applyProject = useCallback(
    (p: ReviewProject, jumpTick: boolean) => {
      commitStrokes(p.strokes, true);
      setSummaryFilter(p.summaryFilter);
      setFloorMode(p.floorMode);
      setPaletteId(p.paletteId);
      setColor(p.color);
      if (jumpTick && p.tick > 0) playbackRef.current.jump(p.tick, true);
    },
    [commitStrokes],
  );

  const snapshotNow = useCallback((): SeriesReviewSnapshot | null => {
    const target = demoRef.current;
    if (!target) return null;
    const overlay = overlayRef.current;
    return {
      demo: target,
      tick: playbackRef.current.tickRef.current,
      strokes: strokesRef.current,
      summaryFilter: overlay.summaryFilter,
      floorMode: overlay.floorMode,
      paletteId: overlay.paletteId,
      color: overlay.color,
    };
  }, []);

  const exportNotes = useCallback(async () => {
    try {
      const projects = await loadAllProjects();
      if (projects.length === 0) {
        statusRef.current.setNotice("No saved notes in this browser yet.");
        return;
      }
      downloadJson("cs2analyzer-notes.json", serializeBundle(projects));
      statusRef.current.setNotice(
        `Exported ${projects.length} saved match${projects.length === 1 ? "" : "es"}.`,
      );
    } catch {
      statusRef.current.setError("Could not export notes.");
    }
  }, []);

  const removeAllNotes = useCallback(async () => {
    try {
      const n = await deleteAllProjects();
      refreshSaved();
      if (n === 0) statusRef.current.setNotice("No saved notes in this browser.");
      else
        statusRef.current.setNotice(
          `Removed ${n} saved match${n === 1 ? "" : "es"} from this browser.`,
        );
    } catch {
      statusRef.current.setError("Could not remove saved notes.");
    }
  }, [refreshSaved]);

  const importNotesText = useCallback(
    async (text: string) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        statusRef.current.setError("Notes file is not valid JSON.");
        return;
      }
      const bundle = parseBundle(raw);
      if (!bundle || bundle.projects.length === 0) {
        statusRef.current.setError("Notes file has no valid reviews.");
        return;
      }
      const n = await importProjects(bundle);
      refreshSaved();
      statusRef.current.setError(null);
      statusRef.current.setNotice(
        `Imported ${n} saved match${n === 1 ? "" : "es"}. Drop the demo to restore drawings.`,
      );
      const current = demoRef.current;
      if (!current) return;
      const mine = bundle.projects.find(
        (p) => p.key === matchKey(current.replay, current.fileName),
      );
      if (mine) applyProject(mine, false);
    },
    [applyProject, refreshSaved],
  );

  const persist = useCallback(
    async (target: LoadedDemo | null, opts?: { stats?: boolean; refreshList?: boolean }) => {
      if (!target) return;
      const overlay = overlayRef.current;
      const key = matchKey(target.replay, target.fileName);
      const existing = await loadProject(key);
      const endTick = matchEndTick(target.replay);
      const withStats = opts?.stats !== false;
      let scorecard = existing?.scorecard;
      let playerStats = existing?.playerStats;
      if (withStats) {
        scorecard = matchScorecard(target.replay, endTick);
        playerStats = savedPlayerSnapshots(target.replay, endTick);
      }
      await saveProject({
        schema: PROJECT_SCHEMA,
        key,
        savedAt: Date.now(),
        fileName: target.fileName,
        mapName: target.replay.header.map_name,
        tick: playbackRef.current.tickRef.current,
        strokes: strokesRef.current,
        summaryFilter: overlay.summaryFilter,
        floorMode: overlay.floorMode,
        paletteId: overlay.paletteId,
        color: overlay.color,
        scorecard,
        playerStats,
        fileSizeBytes: target.file.size > 0 ? target.file.size : undefined,
      });
      if (opts?.refreshList !== false) refreshSaved();
    },
    [refreshSaved],
  );

  /** Scorecard + player table for saved-notes list; keeps any existing drawings. */
  const seedDemoStats = useCallback(async (target: LoadedDemo) => {
    const key = matchKey(target.replay, target.fileName);
    const existing = await loadProject(key);
    const endTick = matchEndTick(target.replay);
    await saveProject({
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
    });
  }, []);

  const seededSeriesRef = useRef<string | null>(null);

  /** Save the demo currently on screen, e.g. before the tab closes. */
  const persistNow = useCallback(() => persist(demoRef.current).catch(() => undefined), [persist]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // After a multi-demo parse, fill scorecard + player stats for every file (not only the active one).
  useEffect(() => {
    if (!series || series.demos.length <= 1) {
      if (!series) seededSeriesRef.current = null;
      return;
    }
    const key = series.demos.map((d) => d.id).join("\0");
    if (seededSeriesRef.current === key) return;
    seededSeriesRef.current = key;
    let cancelled = false;
    void (async () => {
      for (const d of series.demos) {
        if (cancelled) return;
        await seedDemoStats(d);
      }
      if (!cancelled) refreshSaved();
    })();
    return () => {
      cancelled = true;
    };
  }, [series, seedDemoStats, refreshSaved]);

  // Drop the outgoing demo's drawings before a new one paints — except series hops.
  useLayoutEffect(() => {
    if (!demo?.id) return;
    const switchingSeries =
      series != null && prevDemoIdRef.current != null && prevDemoIdRef.current !== demo.id;
    restoredRef.current = false;
    if (switchingSeries) return;
    commitStrokes([], true);
    setSummaryFilter(DEFAULT_SUMMARY_FILTER);
    setFloorMode("auto");
  }, [demo?.id, series, commitStrokes]);

  const flushSeriesCache = useCallback(async () => {
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
  }, []);

  /** Call before swapping the active file in a series (refs still point at the outgoing demo). */
  const stashForSeriesSwitch = useCallback(() => {
    const snap = snapshotNow();
    if (snap) setSeriesReview(snap);
  }, [snapshotNow]);

  // Restore this demo's review on load, and save it again on the way out.
  useEffect(() => {
    if (!demo) {
      prevDemoIdRef.current = null;
      return;
    }
    const isSwitch = prevDemoIdRef.current !== null && prevDemoIdRef.current !== demo.id;
    prevDemoIdRef.current = demo.id;
    let cancelled = false;

    const inSeries = series?.demos.some((d) => d.id === demo.id) ?? false;
    const cached = inSeries ? getSeriesReview(demo.id) : undefined;

    if (cached) {
      queueMicrotask(() => {
        if (cancelled) return;
        applySnapshot(cached, false);
        restoredRef.current = true;
      });
      return () => {
        cancelled = true;
      };
    }

    if (inSeries && isSwitch) {
      restoredRef.current = true;
      void loadProject(matchKey(demo.replay, demo.fileName))
        .then((project) => {
          if (cancelled || !project) return;
          applyProject(project, false);
          playbackRef.current.setPlaying(false);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    const settle = (project: ReviewProject | null) => {
      if (cancelled) return;
      restoredRef.current = true;
      if (!project) {
        if (!isSwitch) playbackRef.current.setPlaying(true);
        return;
      }
      applyProject(project, true);
      playbackRef.current.setPlaying(false);
      statusRef.current.setNotice((prev) =>
        prev ? `${prev}. Restored drawings for this match.` : "Restored drawings for this match.",
      );
    };
    void loadProject(matchKey(demo.replay, demo.fileName))
      .then(settle)
      .catch(() => settle(null));
    return () => {
      cancelled = true;
      if (!inSeries) {
        void persist(demo, { stats: false, refreshList: false }).catch(() => undefined);
      }
    };
  }, [demo, series, applyProject, applySnapshot, persist]);

  useEffect(() => {
    if (series) return;
    void flushSeriesCache().catch(() => undefined);
  }, [series, flushSeriesCache]);

  useEffect(() => {
    if (!demo || !restoredRef.current) return;
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

  const tryOpenSaved = useCallback(async (project: ReviewProject): Promise<File | null> => {
    const file = await readLinkedDemoFile(project.key);
    if (!file) return null;
    if (file.name !== project.fileName) {
      statusRef.current.setError(
        `Linked file is ${file.name}, expected ${project.fileName}. Re-link the demo.`,
      );
      return null;
    }
    return file;
  }, []);

  const linkDemoFile = useCallback(
    async (project: ReviewProject) => {
      if (!demoFilePickerAvailable()) {
        statusRef.current.setNotice(
          "Link demo file works in Chrome/Edge. Otherwise drop the .dem manually.",
        );
        return;
      }
      try {
        const handle = await pickDemoFileHandle();
        if (!handle) return;
        if (handle.name !== project.fileName) {
          statusRef.current.setError(
            `Pick ${project.fileName} — selected ${handle.name}. Notes stay keyed by filename.`,
          );
          return;
        }
        await saveDemoFileHandle(project.key, handle);
        const existing = await loadProject(project.key);
        if (existing) {
          await saveProject({
            ...existing,
            linkedFileLabel: handle.name,
            savedAt: Date.now(),
          });
        }
        refreshSaved();
        statusRef.current.setNotice(`Linked ${handle.name} for saved notes.`);
      } catch {
        statusRef.current.setNotice("Demo link cancelled.");
      }
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
    linkDemoFile,
  };
}

export type ReviewStore = ReturnType<typeof useReviewProject>;
