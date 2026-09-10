import { useEffect, useRef } from "react";
import type { Replay } from "@/lib/replay/replayTypes";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import type { DemoSeries } from "@/lib/parse/session";
import { demoHopSelected } from "./playerSelection";

/**
 * Multi-demo only: after a file hop, remap `selected` from the habits player key.
 * Radar / spec HUD / series list write both fields through `playerSelection` — not here.
 */
export function usePlayerSync(opts: {
  series: DemoSeries | null;
  replay: Replay | null;
  activeDemoId: string | null;
  selected: number | null;
  setSelected: (index: number | null) => void;
  playerKey: string | null;
}): void {
  const { series, replay, activeDemoId, selected, setSelected, playerKey } = opts;
  const prevDemoIdRef = useRef(activeDemoId);

  useEffect(() => {
    const prev = prevDemoIdRef.current;
    prevDemoIdRef.current = activeDemoId;
    if (!isMultiDemoSeries(series) || !replay) return;
    if (prev === activeDemoId) return;
    const idx = demoHopSelected(replay, playerKey);
    if (idx !== selected) setSelected(idx);
  }, [series, replay, activeDemoId, selected, setSelected, playerKey]);
}
