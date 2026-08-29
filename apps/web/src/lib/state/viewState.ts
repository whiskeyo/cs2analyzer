import { useCallback, useRef, useState, useLayoutEffect } from "react";
import { DEFAULT_LAYERS, type DrawTool, type MapLayers } from "@/lib/notes/types";

/**
 * Radar view state that is not persisted with a review: selection, camera
 * follow, trails, the active draw tool, and layer toggles. Resets whenever a
 * different demo is loaded.
 */
export function useViewState(demoId: string | null) {
  const [selected, setSelected] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [trails, setTrails] = useState(false);
  const [moment, setMoment] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pan");
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [viewEpoch, setViewEpoch] = useState(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const prevDemoIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!demoId) {
      prevDemoIdRef.current = null;
      return;
    }
    if (prevDemoIdRef.current === demoId) return;
    prevDemoIdRef.current = demoId;
    setSelected(null);
    setFollow(false);
    setLayers(DEFAULT_LAYERS);
  }, [demoId]);

  /** Selecting a player also starts tracking them; deselecting stops. */
  const select = useCallback((index: number | null) => {
    setSelected(index);
    setFollow(index != null);
  }, []);

  const resetView = useCallback(() => setViewEpoch((n) => n + 1), []);

  return {
    selected,
    selectedRef,
    select,
    setSelected,
    follow,
    setFollow,
    trails,
    setTrails,
    moment,
    setMoment,
    tool,
    setTool,
    layers,
    setLayers,
    viewEpoch,
    resetView,
  };
}

export type ViewState = ReturnType<typeof useViewState>;
