import { useCallback, useMemo, useState } from "react";
import { canGroup, itemExists } from "./noteGroups";
import { noteForRound } from "./roundNotes";
import type { RoundNote } from "./types";
import { picksEqual, type NotePick } from "./drag";

export function useNoteSelection(notes: RoundNote[]) {
  const [picked, setPicked] = useState<NotePick[]>([]);
  const selected = useMemo(
    () => picked.filter((pick) => itemExists(noteForRound(notes, pick.round), pick.ref)),
    [picked, notes],
  );
  const rounds = new Set(selected.map((pick) => pick.round));
  const sameRound = rounds.size === 1;
  const round = selected[0]?.round ?? 0;
  const refs = selected.map((pick) => pick.ref);
  const canGroupItems = sameRound && canGroup(noteForRound(notes, round), refs);
  const canUngroup = selected.some((pick) => pick.ref.kind === "group");

  const clearSelection = useCallback(() => {
    setPicked([]);
  }, []);

  const toggle = useCallback((pick: NotePick) => {
    setPicked((cur) =>
      cur.some((row) => picksEqual(row, pick))
        ? cur.filter((row) => !picksEqual(row, pick))
        : [...cur, pick],
    );
  }, []);

  const toggleAll = useCallback((picks: NotePick[]) => {
    setPicked((cur) => {
      const allOn = picks.every((pick) => cur.some((row) => picksEqual(row, pick)));
      if (allOn) {
        return cur.filter((row) => !picks.some((pick) => picksEqual(row, pick)));
      }
      const next = [...cur];
      for (const pick of picks) {
        if (!next.some((row) => picksEqual(row, pick))) next.push(pick);
      }
      return next;
    });
  }, []);

  return {
    selected,
    canGroup: canGroupItems,
    canUngroup,
    toggle,
    toggleAll,
    clearSelection,
    setPicked,
  };
}
