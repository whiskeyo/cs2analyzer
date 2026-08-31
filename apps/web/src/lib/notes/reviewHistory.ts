import { useCallback, useRef, useState } from "react";
import { DRAW_HISTORY_LIMIT } from "@/lib/shared/constants";
import type { Stroke } from "./types";

/** Undo/redo stack for review strokes (in-memory only). */
export function useStrokeHistory() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef<Stroke[][]>([[]]);
  const histIdxRef = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }, []);

  const commitStrokes = useCallback((next: Stroke[], reset = false) => {
    if (reset) {
      historyRef.current = [next];
      histIdxRef.current = 0;
    } else {
      const trimmed = historyRef.current.slice(0, histIdxRef.current + 1);
      trimmed.push(next);
      if (trimmed.length > DRAW_HISTORY_LIMIT) {
        trimmed.shift();
      }
      historyRef.current = trimmed;
      histIdxRef.current = trimmed.length - 1;
    }
    setStrokes(next);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) {
      return;
    }
    histIdxRef.current -= 1;
    setStrokes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) {
      return;
    }
    histIdxRef.current += 1;
    setStrokes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  return {
    strokes,
    strokesRef,
    canUndo,
    canRedo,
    commitStrokes,
    undo,
    redo,
  };
}
