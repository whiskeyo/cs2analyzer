import { useCallback, useMemo, useRef, useState } from "react";
import { DRAW_HISTORY_LIMIT } from "@/lib/shared/constants";
import { flattenRoundNotes, strokesToRoundNotes } from "./migrate";
import type { RoundNote, Stroke } from "./types";

/** Undo/redo stack for review notes (in-memory only). */
export function useRoundNoteHistory() {
  const [notes, setNotes] = useState<RoundNote[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef<RoundNote[][]>([[]]);
  const histIdxRef = useRef(0);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }, []);

  const commitNotes = useCallback((next: RoundNote[], reset = false) => {
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
    setNotes(next);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) {
      return;
    }
    histIdxRef.current -= 1;
    setNotes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) {
      return;
    }
    histIdxRef.current += 1;
    setNotes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  return {
    notes,
    notesRef,
    canUndo,
    canRedo,
    commitNotes,
    undo,
    redo,
  };
}

/** Flat Stroke view of `useRoundNoteHistory` for canvas/sidebar until they cut over. */
export function useStrokeHistory() {
  const { notes, notesRef, canUndo, canRedo, commitNotes, undo, redo } = useRoundNoteHistory();
  const strokes = useMemo(() => flattenRoundNotes(notes), [notes]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const commitStrokes = useCallback(
    (next: Stroke[], reset = false) => {
      commitNotes(strokesToRoundNotes(next), reset);
    },
    [commitNotes],
  );
  return {
    strokes,
    strokesRef,
    canUndo,
    canRedo,
    commitStrokes,
    undo,
    redo,
    notes,
    notesRef,
    commitNotes,
  };
}
