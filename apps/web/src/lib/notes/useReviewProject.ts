import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { DRAW_HISTORY_LIMIT, PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import {
  defaultColor,
  defaultPaletteId,
  importProjects,
  loadAllProjects,
  matchKey,
  parseBundle,
  PROJECT_SCHEMA,
  saveProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";
import type { Replay } from "@/lib/replay/replayTypes";
import { DEFAULT_SUMMARY_FILTER, type FloorMode, type Stroke, type SummaryFilter } from "./types";

function downloadJson(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function useReviewProject(opts: {
  replay: Replay | null;
  playing: boolean;
  replayRef: MutableRefObject<Replay | null>;
  fileNameRef: MutableRefObject<string>;
  tickRef: MutableRefObject<number>;
  jump: (t: number, pause?: boolean) => void;
}) {
  const { replay, playing, replayRef, fileNameRef, tickRef, jump } = opts;
  const [saved, setSaved] = useState<ReviewProject[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState(defaultPaletteId);
  const [color, setColor] = useState(defaultColor);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(DEFAULT_SUMMARY_FILTER);
  const [floorMode, setFloorMode] = useState<FloorMode>("auto");
  const historyRef = useRef<Stroke[][]>([[]]);
  const histIdxRef = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const overlayRef = useRef({ summaryFilter, floorMode, paletteId, color });
  overlayRef.current = { summaryFilter, floorMode, paletteId, color };

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
      if (jumpTick && p.tick > 0) jump(p.tick, true);
    },
    [commitStrokes, jump],
  );

  const exportNotes = useCallback(async () => {
    try {
      const projects = await loadAllProjects();
      if (projects.length === 0) {
        setNotice("No saved notes in this browser yet.");
        return;
      }
      downloadJson("cs2analyzer-notes.json", serializeBundle(projects));
      setNotice(`Exported ${projects.length} saved match${projects.length === 1 ? "" : "es"}.`);
    } catch {
      setError("Could not export notes.");
    }
  }, []);

  const importNotesText = useCallback(
    async (text: string) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        setError("Notes file is not valid JSON.");
        return;
      }
      const bundle = parseBundle(raw);
      if (!bundle || bundle.projects.length === 0) {
        setError("Notes file has no valid reviews.");
        return;
      }
      const n = await importProjects(bundle);
      refreshSaved();
      setError(null);
      setNotice(
        `Imported ${n} saved match${n === 1 ? "" : "es"}. Drop the demo to restore drawings.`,
      );
      const r = replayRef.current;
      if (!r) return;
      const key = matchKey(r, fileNameRef.current);
      const mine = bundle.projects.find((p) => p.key === key);
      if (mine) applyProject(mine, false);
    },
    [applyProject, fileNameRef, refreshSaved, replayRef],
  );

  const persistNow = useCallback(() => {
    const r = replayRef.current;
    if (!r) return Promise.resolve();
    const overlay = overlayRef.current;
    return saveProject({
      schema: PROJECT_SCHEMA,
      key: matchKey(r, fileNameRef.current),
      savedAt: Date.now(),
      fileName: fileNameRef.current,
      mapName: r.header.map_name,
      tick: tickRef.current,
      strokes: strokesRef.current,
      summaryFilter: overlay.summaryFilter,
      floorMode: overlay.floorMode,
      paletteId: overlay.paletteId,
      color: overlay.color,
    })
      .then(refreshSaved)
      .catch(() => undefined);
  }, [fileNameRef, refreshSaved, replayRef, tickRef]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!replay) return;
    const id = window.setTimeout(() => {
      void persistNow();
    }, PROJECT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [replay, playing, strokes, summaryFilter, floorMode, paletteId, color, persistNow]);

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
    error,
    setError,
    notice,
    setNotice,
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
