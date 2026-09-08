import { useCallback, useEffect, useRef, useState } from "react";
import { DRAW_HISTORY_COALESCE_MS, DRAW_HISTORY_LIMIT } from "@/lib/shared/constants";
import { cloneNote, emptyNote } from "@/lib/notes/note";
import type { Note } from "@/lib/notes/types";

export function useNoteHistory(pageId: string | null, note: Note | null) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pastRef = useRef<Note[]>([]);
  const futureRef = useRef<Note[]>([]);
  const presentRef = useRef<Note>(note ? cloneNote(note) : emptyNote());
  const lastCommitAtRef = useRef(0);
  const pageRef = useRef(pageId);

  const sync = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  useEffect(() => {
    if (pageRef.current !== pageId) {
      pageRef.current = pageId;
      pastRef.current = [];
      futureRef.current = [];
      presentRef.current = note ? cloneNote(note) : emptyNote();
      lastCommitAtRef.current = 0;
      sync();
      return;
    }
    if (pastRef.current.length === 0 && futureRef.current.length === 0) {
      presentRef.current = note ? cloneNote(note) : emptyNote();
    }
  }, [pageId, note, sync]);

  const pushPresent = useCallback(
    (next: Note) => {
      const now = Date.now();
      const coalesce = now - lastCommitAtRef.current < DRAW_HISTORY_COALESCE_MS;
      if (!coalesce) {
        pastRef.current.push(cloneNote(presentRef.current));
        if (pastRef.current.length > DRAW_HISTORY_LIMIT) pastRef.current.shift();
      }
      presentRef.current = cloneNote(next);
      futureRef.current = [];
      lastCommitAtRef.current = now;
      sync();
    },
    [sync],
  );

  const undo = useCallback((): Note | null => {
    const prev = pastRef.current.pop();
    if (!prev) return null;
    futureRef.current.push(cloneNote(presentRef.current));
    presentRef.current = cloneNote(prev);
    lastCommitAtRef.current = 0;
    sync();
    return cloneNote(prev);
  }, [sync]);

  const redo = useCallback((): Note | null => {
    const next = futureRef.current.pop();
    if (!next) return null;
    pastRef.current.push(cloneNote(presentRef.current));
    presentRef.current = cloneNote(next);
    lastCommitAtRef.current = 0;
    sync();
    return cloneNote(next);
  }, [sync]);

  return { canUndo, canRedo, pushPresent, undo, redo };
}
