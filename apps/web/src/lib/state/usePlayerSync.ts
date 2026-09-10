import { useLayoutEffect, useRef } from "react";
import type { Replay } from "@/lib/replay/replayTypes";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import type { DemoSeries } from "@/lib/parse/session";
import { demoHopSelected } from "./playerSelection";

/**
 * Multi-demo only: after a file hop, remap `selected` from the habits player key.
 * Radar / spec HUD / series list write both fields through `playerSelection` — not here.
 *
 * Layout effect so the slot is restored in the same turn as `useViewState`'s
 * demo-change reset (which clears `selected` first). Always write the index —
 * the same slot in two files would otherwise lose to the reset's null.
 */
export function usePlayerSync(opts: {
  series: DemoSeries | null;
  replay: Replay | null;
  activeDemoId: string | null;
  setSelected: (index: number | null) => void;
  playerKey: string | null;
}): void {
  const { series, replay, activeDemoId, setSelected, playerKey } = opts;
  const prevDemoIdRef = useRef(activeDemoId);

  useLayoutEffect(() => {
    const prev = prevDemoIdRef.current;
    prevDemoIdRef.current = activeDemoId;
    if (!isMultiDemoSeries(series) || !replay) return;
    if (prev === activeDemoId) return;
    setSelected(demoHopSelected(replay, playerKey));
  }, [series, replay, activeDemoId, setSelected, playerKey]);
}
