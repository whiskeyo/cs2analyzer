import { useCallback } from "react";
import { tickRate } from "@/lib/shared/constants";
import { roundWindowEnd } from "@/components/sidebar/NoteClocks";
import { clearMomentWindow, setMomentClockEdge, setMomentEdge } from "@/lib/notes";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { Stroke } from "@/lib/notes/types";

export function useNoteMoments(opts: {
  replay: Replay;
  tick: number;
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
}) {
  const { replay, tick, strokes, onStrokes } = opts;
  const tps = tickRate(replay);

  const setEdge = useCallback(
    (index: number, edge: "start" | "end", rnd: Round | undefined) => {
      onStrokes(
        setMomentEdge(
          strokes,
          index,
          edge,
          tick,
          rnd?.start_tick ?? 0,
          roundWindowEnd(rnd, replay),
          tps,
        ),
      );
    },
    [onStrokes, replay, strokes, tick, tps],
  );

  const setClock = useCallback(
    (index: number, edge: "start" | "end", seconds: number, rnd: Round | undefined) => {
      const origin = rnd ? rnd.freeze_end_tick || rnd.start_tick : 0;
      onStrokes(
        setMomentClockEdge(
          strokes,
          index,
          edge,
          seconds,
          origin,
          rnd?.start_tick ?? 0,
          roundWindowEnd(rnd, replay),
          tps,
        ),
      );
    },
    [onStrokes, replay, strokes, tps],
  );

  const clearWindow = useCallback(
    (index: number) => {
      onStrokes(clearMomentWindow(strokes, index));
    },
    [onStrokes, strokes],
  );

  return { tps, setEdge, setClock, clearWindow };
}
