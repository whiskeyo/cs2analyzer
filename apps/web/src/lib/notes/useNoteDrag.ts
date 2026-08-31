import { useCallback, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { dropStrokesOn, type NoteDropDest } from "@/lib/notes";
import { isDragControl, parseDrag, type NoteDrag } from "@/lib/notes/drag";
import type { Stroke } from "@/lib/notes/types";

export function useNoteDrag(opts: {
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
  clearSelection: () => void;
}) {
  const { strokes, onStrokes, clearSelection } = opts;
  const [dragging, setDragging] = useState<NoteDrag | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dragRef = useRef<NoteDrag | null>(null);
  const skipClick = useRef(false);
  const dragged = useRef(false);
  const downOnRef = useRef<EventTarget | null>(null);

  const startDrag = useCallback((e: ReactDragEvent, round: number, indexes: number[]) => {
    if (isDragControl(downOnRef.current)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    dragged.current = false;
    skipClick.current = false;
    const payload: NoteDrag = { round, indexes };
    dragRef.current = payload;
    setDragging(payload);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  }, []);

  const markDrag = useCallback(() => {
    dragged.current = true;
  }, []);

  const endDrag = useCallback(() => {
    skipClick.current = dragged.current;
    dragged.current = false;
    dragRef.current = null;
    setDragging(null);
    setDropOn(null);
    window.setTimeout(() => {
      skipClick.current = false;
    }, 80);
  }, []);

  const dropAt = useCallback(
    (e: ReactDragEvent, dest: NoteDropDest) => {
      e.preventDefault();
      e.stopPropagation();
      const payload = dragRef.current ?? parseDrag(e.dataTransfer.getData("text/plain"));
      if (!payload || payload.round !== dest.round) {
        endDrag();
        return;
      }
      onStrokes(dropStrokesOn(strokes, payload.indexes, dest));
      clearSelection();
      endDrag();
    },
    [clearSelection, endDrag, onStrokes, strokes],
  );

  const allowDrop = useCallback(
    (e: ReactDragEvent, key: string, sameRound: boolean) => {
      if (!dragRef.current || !sameRound) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dropOn !== key) {
        setDropOn(key);
      }
    },
    [dropOn],
  );

  return {
    dragging,
    dropOn,
    downOnRef,
    skipClick,
    startDrag,
    markDrag,
    endDrag,
    dropAt,
    allowDrop,
  };
}
