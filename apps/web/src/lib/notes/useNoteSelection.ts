import { useCallback, useMemo, useState } from "react";
import { canGroupIndexes } from "@/lib/notes";
import type { Stroke } from "@/lib/notes/types";

export function useNoteSelection(strokes: Stroke[]) {
  const [picked, setPicked] = useState<number[]>([]);
  const selected = useMemo(() => picked.filter((i) => strokes[i] != null), [picked, strokes]);
  const canGroup = canGroupIndexes(strokes, selected);
  const canUngroup = selected.some((i) => strokes[i]?.group);

  const clearSelection = useCallback(() => {
    setPicked([]);
  }, []);

  const toggle = useCallback((index: number) => {
    setPicked((cur) => (cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index]));
  }, []);

  const toggleAll = useCallback((indexes: number[]) => {
    setPicked((cur) => {
      const allOn = indexes.every((i) => cur.includes(i));
      if (allOn) {
        return cur.filter((i) => !indexes.includes(i));
      }
      return [...new Set([...cur, ...indexes])];
    });
  }, []);

  return {
    selected,
    canGroup,
    canUngroup,
    toggle,
    toggleAll,
    clearSelection,
    setPicked,
  };
}
