import { useCallback } from "react";
import { tickRate } from "@/lib/shared/constants";
import { roundWindowEnd } from "@/components/sidebar/NoteClocks";
import { clearMomentWindow, setMomentClockEdge, setMomentEdge } from "@/lib/notes";
import { updateRoundNote } from "@/lib/notes/roundNotes";
import type { NoteItemRef } from "@/lib/notes/noteGroups";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { RoundNote } from "@/lib/notes/types";

export function useNoteMoments(opts: {
  replay: Replay;
  tick: number;
  notes: RoundNote[];
  onNotes: (next: RoundNote[]) => void;
  momentSec?: number;
}) {
  const { replay, tick, notes, onNotes, momentSec } = opts;
  const tps = tickRate(replay);

  const setEdge = useCallback(
    (round: number, ref: NoteItemRef, edge: "start" | "end", rnd: Round | undefined) => {
      onNotes(
        updateRoundNote(notes, round, (note) =>
          setMomentEdge(
            note,
            ref,
            edge,
            tick,
            rnd?.start_tick ?? 0,
            roundWindowEnd(rnd, replay),
            tps,
            momentSec,
          ),
        ),
      );
    },
    [notes, onNotes, replay, tick, tps, momentSec],
  );

  const setClock = useCallback(
    (
      round: number,
      ref: NoteItemRef,
      edge: "start" | "end",
      seconds: number,
      rnd: Round | undefined,
    ) => {
      const origin = rnd ? rnd.freeze_end_tick || rnd.start_tick : 0;
      onNotes(
        updateRoundNote(notes, round, (note) =>
          setMomentClockEdge(
            note,
            ref,
            edge,
            seconds,
            origin,
            rnd?.start_tick ?? 0,
            roundWindowEnd(rnd, replay),
            tps,
            momentSec,
          ),
        ),
      );
    },
    [notes, onNotes, replay, tps, momentSec],
  );

  const clearWindow = useCallback(
    (round: number, ref: NoteItemRef) => {
      onNotes(updateRoundNote(notes, round, (note) => clearMomentWindow(note, ref)));
    },
    [notes, onNotes],
  );

  return { tps, setEdge, setClock, clearWindow };
}
