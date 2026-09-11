import { useCallback, useRef, useState } from "react";
import { useResetOnDemoChange } from "@/lib/state/demoReset";
import { DEFAULT_LAYERS, type DrawTool, type MapLayers } from "@/lib/notes/types";

/**
 * Radar view state that is not persisted with a review: selection, camera
 * follow, trails, the active draw tool, and layer toggles. Resets whenever a
 * different demo is loaded (including a series file hop). Habits filters stay
 * on the series identity — see `useSeriesHabits`.
 */
export function useViewState(demoId: string | null, defaultLayers: MapLayers = DEFAULT_LAYERS) {
  const layersDefaultRef = useRef(defaultLayers);
  layersDefaultRef.current = defaultLayers;
  const [selected, setSelectedState] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [trails, setTrails] = useState(false);
  const [moment, setMoment] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pan");
  const [layers, setLayers] = useState<MapLayers>(() => ({ ...defaultLayers }));
  const [viewEpoch, setViewEpoch] = useState(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useResetOnDemoChange(demoId, () => {
    setSelectedState(null);
    setFollow(false);
    setLayers({ ...layersDefaultRef.current });
    setTrails(false);
    setMoment(false);
    setTool("pan");
    setViewEpoch((n) => n + 1);
  });

  /** Selecting a player highlights them; tracking is opt-in (Track / F). */
  const select = useCallback((index: number | null) => {
    setSelectedState(index);
    if (index == null) setFollow(false);
  }, []);

  const resetView = useCallback(() => setViewEpoch((n) => n + 1), []);

  return {
    selected,
    selectedRef,
    select,
    setSelected: select,
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
