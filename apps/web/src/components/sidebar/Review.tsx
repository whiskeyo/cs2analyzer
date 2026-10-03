import { useMemo } from "react";
import { liveClutch } from "@/lib/match/clutches";
import { playerReview } from "@/lib/match/review";
import { reviewHeadshotLine } from "@/lib/match/reviewHeadshot";
import { computeStats, matchEndTick } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { OpeningDuels } from "./OpeningDuels";
import { ReviewNoteFlow } from "./ReviewNoteFlow";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
  /** Match-wide opening list. Off in Aggregated view. */
  showOpenings?: boolean;
}

export function Review({ replay, tick, selected, onJump, onSelect, showOpenings = true }: Props) {
  const end = matchEndTick(replay);
  const name = selected != null ? (replay.players[selected]?.name ?? "Player") : null;
  const review = useMemo(
    () => (selected != null ? playerReview(replay, selected, end) : null),
    [replay, selected, end],
  );
  const hsLine = useMemo(() => {
    if (selected == null) return null;
    return reviewHeadshotLine(computeStats(replay, end)[selected]);
  }, [replay, selected, end]);
  const live = liveClutch(replay, tick);
  const showLive = live != null && selected != null && live.player === selected;

  const playerBody =
    selected == null || !name || !review ? (
      <p className="tab-hint">Select a player on the scoreboard or radar to see their review.</p>
    ) : (
      <>
        <p className="tab-hint">
          <strong>{name}</strong>
          {hsLine ? ` · ${hsLine}` : ""} — openings, clutches, and mistakes.
        </p>
        {showLive && live && (
          <button
            type="button"
            className="review-note on"
            onClick={() => {
              onSelect(live.player);
              onJump(live.tick);
            }}
          >
            <span className="pill review-round">Live</span>
            <span className="review-copy">
              <span className="review-title">
                {live.name} 1v{live.vs}
              </span>
              <span className="review-detail">in progress · {live.side}</span>
            </span>
          </button>
        )}
        {review.headlines.length === 0 && review.notes.length === 0 && !showLive ? (
          <p className="muted tab-hint">No player notes in this match.</p>
        ) : (
          <>
            {review.headlines.length > 0 && (
              <ul className="review-heads">
                {review.headlines.map((h) => (
                  <li key={h.text} className={`review-head ${h.severity}`}>
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
            <ReviewNoteFlow
              notes={review.notes}
              pendingAtTick={tick}
              onJump={(note) => onJump(note.tick)}
            />
          </>
        )}
      </>
    );

  return (
    <div className="review">
      {playerBody}
      {showOpenings && <OpeningDuels replay={replay} tick={tick} onJump={onJump} />}
    </div>
  );
}
