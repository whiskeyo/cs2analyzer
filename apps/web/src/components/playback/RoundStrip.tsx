import { memo, useEffect, useState } from "react";
import { useMessages } from "@/lib/i18n/useMessages";
import { blockTransportFocus } from "@/lib/playback/transportFocus";
import { tickRate } from "@/lib/shared/constants";
import { activeExecute, findExecutes, type ExecuteBeat } from "@/lib/match/execute";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { RoundNote } from "@/lib/notes/types";
import { noteRounds } from "@/lib/notes";
import { useSendPlaybackCommand } from "@/lib/playback/playbackCommandContext";
import type { MapPlaces } from "@/lib/match/sites";

interface Props {
  replay: Replay;
  tick: number;
  notes: RoundNote[];
  places: MapPlaces | null;
  activeRound?: Round | null;
}

export const RoundStrip = memo(function RoundStrip({
  replay,
  tick,
  notes,
  places,
  activeRound,
}: Props) {
  const { messages, t } = useMessages();
  const send = useSendPlaybackCommand();
  const current = activeRound ?? currentRound(replay, tick);
  const [beats, setBeats] = useState<ExecuteBeat[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setBeats(findExecutes(replay, places));
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run);
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [replay, places]);

  const actionRounds = new Set(beats.map((b) => b.round));
  const noted = noteRounds(notes);
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
            tabIndex={-1}
            role="listitem"
            className={`rs${current?.start_tick === r.start_tick ? " on" : ""}${hasAction ? " has-action" : ""}${hasNotes ? " has-notes" : ""}${liveAction ? " live-action" : ""} ${
              r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : "none"
            }`}
            title={
              r.is_knife
                ? messages.playback.knife
                : [
                    t(messages.playback.roundStrip, { number: r.number }),
                    hasAction ? messages.playback.roundHasExecute : "",
                    hasNotes ? messages.playback.roundHasNotes : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
            onMouseDown={blockTransportFocus}
            onClick={() => send({ type: "jump", tick: 0, pause: true, round: r })}
          >
            {r.is_knife ? "K" : r.number}
          </button>
        );
      })}
    </div>
  );
});
