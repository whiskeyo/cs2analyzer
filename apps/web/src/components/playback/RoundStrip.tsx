import { memo } from "react";
import { tickRate } from "@/lib/shared/constants";
import { activeExecute, findExecutes } from "@/lib/match/execute";
import { currentRound } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import type { Stroke } from "@/lib/notes/types";
import { noteRounds, overlayJumpTick } from "@/lib/notes";
import type { MapPlaces } from "@/lib/match/sites";

interface Props {
  replay: Replay;
  tick: number;
  strokes: Stroke[];
  onJump: (tick: number) => void;
  places: MapPlaces | null;
}

export const RoundStrip = memo(function RoundStrip({
  replay,
  tick,
  strokes,
  onJump,
  places,
}: Props) {
  const current = currentRound(replay, tick);
  const beats = findExecutes(replay, places);
  const actionRounds = new Set(beats.map((b) => b.round));
  const noted = noteRounds(strokes);
  const live = activeExecute(beats, tick, tickRate(replay));
  return (
    <div className="round-strip" role="list">
      {replay.rounds.map((r) => {
        const hasAction = !r.is_knife && actionRounds.has(r.number);
        const hasNotes = noted.has(r.number);
        const liveAction = live != null && live.round === r.number;
        return (
          <button
            key={r.start_tick}
            type="button"
            role="listitem"
            className={`rs${current?.start_tick === r.start_tick ? " on" : ""}${hasAction ? " has-action" : ""}${hasNotes ? " has-notes" : ""}${liveAction ? " live-action" : ""} ${
              r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : "none"
            }`}
            title={
              r.is_knife
                ? "Knife"
                : [`Round ${r.number}`, hasAction ? "execute" : "", hasNotes ? "notes" : ""]
                    .filter(Boolean)
                    .join(" · ")
            }
            onClick={() => onJump(overlayJumpTick(strokes, r))}
          >
            {r.is_knife ? "K" : r.number}
          </button>
        );
      })}
    </div>
  );
});
