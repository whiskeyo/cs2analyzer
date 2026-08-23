import { currentRound } from "./sample";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
}

export function RoundStrip({ replay, tick, onJump }: Props) {
  const current = currentRound(replay, tick);
  return (
    <div className="round-strip" role="list">
      {replay.rounds.map((r) => (
        <button
          key={r.start_tick}
          type="button"
          role="listitem"
          className={`rs${current?.start_tick === r.start_tick ? " on" : ""} ${
            r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : "none"
          }`}
          title={r.is_knife ? "Knife" : `Round ${r.number}`}
          onClick={() => onJump(r.freeze_end_tick || r.start_tick)}
        >
          {r.is_knife ? "K" : r.number}
        </button>
      ))}
    </div>
  );
}
