import { tickRate } from "./constants";
import { activeExecute, findExecutes } from "./execute";
import { currentRound } from "./sample";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
}

export function RoundStrip({ replay, tick, onJump }: Props) {
  const current = currentRound(replay, tick);
  const beats = findExecutes(replay);
  const actionRounds = new Set(beats.map((b) => b.round));
  const live = activeExecute(beats, tick, tickRate(replay));
  return (
    <div className="round-strip" role="list">
      {replay.rounds.map((r) => {
        const hasAction = !r.is_knife && actionRounds.has(r.number);
        const liveAction = live != null && live.round === r.number;
        return (
          <button
            key={r.start_tick}
            type="button"
            role="listitem"
            className={`rs${current?.start_tick === r.start_tick ? " on" : ""}${hasAction ? " has-action" : ""}${liveAction ? " live-action" : ""} ${
              r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : "none"
            }`}
            title={
              r.is_knife ? "Knife" : hasAction ? `Round ${r.number} · execute` : `Round ${r.number}`
            }
            onClick={() => onJump(r.freeze_end_tick || r.start_tick)}
          >
            {r.is_knife ? "K" : r.number}
          </button>
        );
      })}
    </div>
  );
}
