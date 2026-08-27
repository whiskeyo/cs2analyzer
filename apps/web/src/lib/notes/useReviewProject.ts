import { useCallback, useEffect, useRef, useState } from "react";
import { DRAW_HISTORY_LIMIT, PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import {
  defaultColor,
  defaultPaletteId,
  importProjects,
  loadAllProjects,
  loadProject,
  matchKey,
  parseBundle,
  PROJECT_SCHEMA,
  saveProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";
import type { LoadedDemo } from "@/lib/parse/session";
import type { Playback } from "@/lib/playback/usePlayback";
import type { Status } from "@/lib/state/status";
import { useResetOn } from "@/lib/state/useResetOn";
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
  status: Status;
  playback: Playback;
}) {
  const { demo, status, playback } = opts;
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
    (target: LoadedDemo | null) => {
      if (!target) return Promise.resolve();
      const overlay = overlayRef.current;
      return saveProject({
        schema: PROJECT_SCHEMA,
        key: matchKey(target.replay, target.fileName),
        savedAt: Date.now(),
        fileName: target.fileName,
        mapName: target.replay.header.map_name,
        tick: playbackRef.current.tickRef.current,
        strokes: strokesRef.current,
        summaryFilter: overlay.summaryFilter,
        floorMode: overlay.floorMode,
        paletteId: overlay.paletteId,
        color: overlay.color,
      })
        .then(refreshSaved)
        .catch(() => undefined);
    },
    [refreshSaved],
  );

  /** Save the demo currently on screen, e.g. before the tab closes. */
  const persistNow = useCallback(() => persist(demoRef.current), [persist]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // Drop the outgoing demo's drawings before the new one paints a frame.
  useResetOn(demo, () => {
    restoredRef.current = false;
    commitStrokes([], true);
    setSummaryFilter(DEFAULT_SUMMARY_FILTER);
    setFloorMode("auto");
  });

  // Restore this demo's review on load, and save it again on the way out.
  useEffect(() => {
    if (!demo) return;
    let cancelled = false;
    const settle = (project: ReviewProject | null) => {
      if (cancelled) return;
      restoredRef.current = true;
      if (!project) {
        playbackRef.current.setPlaying(true);
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
      void persist(demo);
    };
  }, [demo, applyProject, persist]);

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
    persistNow,
  };
}

export type ReviewStore = ReturnType<typeof useReviewProject>;
