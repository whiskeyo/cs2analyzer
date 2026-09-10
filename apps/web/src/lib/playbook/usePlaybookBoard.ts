import { useCallback, useEffect, useState } from "react";
import type { NadeStyle, Note } from "@/lib/notes/types";
import {
  colorAtSwatch,
  cyclePaletteId,
  PLAYBOOK_COLOR_KEYS,
  PLAYBOOK_TOOL_KEYS,
  typingInField,
} from "./hotkeys";
import { pawnLegend, shouldShowPawnLegend, visiblePieces } from "./legend";
import type { PlaybookTool } from "./pieces";
import type { Playbook, PlaybookPage } from "./types";
import type { useNoteHistory } from "./history";

type NoteHistory = ReturnType<typeof useNoteHistory>;

/**
 * Board chrome for Playbook: tool, selection, nade preview, view reset, and
 * the keybindings that drive them. The page keeps map load, URL sync, and tree.
 */
export function usePlaybookBoard(opts: {
  book: Playbook | null;
  page: PlaybookPage | null;
  history: NoteHistory;
  setNote: (note: Note) => void;
  setPalette: (paletteId: string, color?: string) => void;
}) {
  const { book, page, history, setNote, setPalette } = opts;
  const [tool, setTool] = useState<PlaybookTool>("pan");
  const [nadeTrail, setNadeTrail] = useState(false);
  const [nadeStyle, setNadeStyle] = useState<NadeStyle>("icon");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewEpoch, setViewEpoch] = useState(0);

  const resetView = useCallback(() => setViewEpoch((n) => n + 1), []);

  const commitNote = useCallback(
    (note: Note) => {
      history.pushPresent(note);
      setNote(note);
    },
    [history, setNote],
  );

  const undo = useCallback(() => {
    const prev = history.undo();
    if (prev) setNote(prev);
  }, [history, setNote]);

  const redo = useCallback(() => {
    const next = history.redo();
    if (next) setNote(next);
  }, [history, setNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField()) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        setSelectedId(null);
        setTool("pan");
        return;
      }
      if (e.key.toLowerCase() === "r") {
        resetView();
        return;
      }
      if (e.key.toLowerCase() === "n") {
        setNadeTrail((on) => !on);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        setNadeStyle((style) => (style === "icon" ? "effect" : "icon"));
        return;
      }
      if (e.key === "[" || e.key === "]") {
        if (!book) return;
        const nextId = cyclePaletteId(book.paletteId, e.key === "]" ? 1 : -1);
        setPalette(nextId);
        return;
      }
      const swatch = PLAYBOOK_COLOR_KEYS.findIndex((key) => key === e.key);
      if (swatch >= 0 && book) {
        const next = colorAtSwatch(book.paletteId, swatch);
        if (next) setPalette(book.paletteId, next);
        return;
      }
      const nextTool = PLAYBOOK_TOOL_KEYS[e.key.toLowerCase()];
      if (nextTool) setTool(nextTool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [book, redo, resetView, setPalette, undo]);

  const visibleSelectedId = page?.note.pieces.some((piece) => piece.id === selectedId)
    ? selectedId
    : null;
  const boardPieces = page ? visiblePieces(page.note) : [];
  const legend = shouldShowPawnLegend(boardPieces) ? pawnLegend(boardPieces) : [];

  return {
    tool,
    setTool,
    nadeTrail,
    setNadeTrail,
    nadeStyle,
    setNadeStyle,
    selectedId,
    setSelectedId,
    visibleSelectedId,
    viewEpoch,
    resetView,
    boardPieces,
    legend,
    commitNote,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
