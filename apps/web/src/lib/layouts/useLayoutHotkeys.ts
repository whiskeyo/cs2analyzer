import { useEffect, type MutableRefObject } from "react";
import { canGroupIds, canUngroupIds, groupCallouts, ungroupCallouts } from "./groups";
import type { LayoutCallout, MapLayout } from "./types";
import type { LayoutTool } from "./useLayoutPointer";

function typingInField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

const TOOL_KEYS: Record<string, LayoutTool> = {
  "1": "pan",
  "2": "polygon",
  "3": "rect",
  "4": "circle",
  "5": "select",
};

export interface LayoutHotkeyOpts {
  closeDraft: () => void;
  cancelDraft: () => void;
  save: () => void;
  selectedIdsRef: MutableRefObject<string[]>;
  layoutRef: MutableRefObject<MapLayout>;
  onCallouts: (next: LayoutCallout[]) => void;
  clearSelection: () => void;
  deleteCallouts: (ids: string[]) => void;
  pickTool: (tool: LayoutTool) => void;
  resetView: () => void;
}

export function useLayoutHotkeys(opts: LayoutHotkeyOpts): void {
  const {
    closeDraft,
    cancelDraft,
    save,
    selectedIdsRef,
    layoutRef,
    onCallouts,
    clearSelection,
    deleteCallouts,
    pickTool,
    resetView,
  } = opts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typingInField()) return;
      if (e.key === "Enter") {
        e.preventDefault();
        closeDraft();
      }
      if (e.key === "Escape") {
        cancelDraft();
        clearSelection();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        deleteCallouts(selectedIdsRef.current);
      }
      if (e.key.toLowerCase() === "g") {
        const ids = selectedIdsRef.current;
        if (canGroupIds(layoutRef.current.callouts, ids)) {
          e.preventDefault();
          onCallouts(groupCallouts(layoutRef.current.callouts, ids));
          clearSelection();
        }
        return;
      }
      if (e.key.toLowerCase() === "u") {
        const ids = selectedIdsRef.current;
        if (canUngroupIds(layoutRef.current.callouts, ids)) {
          e.preventDefault();
          onCallouts(ungroupCallouts(layoutRef.current.callouts, ids));
          clearSelection();
        }
        return;
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        resetView();
        return;
      }
      const tool = TOOL_KEYS[e.key];
      if (tool) pickTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cancelDraft,
    clearSelection,
    closeDraft,
    deleteCallouts,
    layoutRef,
    onCallouts,
    pickTool,
    resetView,
    save,
    selectedIdsRef,
  ]);
}
