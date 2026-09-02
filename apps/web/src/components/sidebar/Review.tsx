import { useMemo } from "react";
import { liveClutch } from "@/lib/match/clutches";
import { playerReview } from "@/lib/match/review";
import { matchEndTick } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
}

function noteClass(severity: string, pending: boolean): string {
  return `review-note ${severity}${pending ? " pending" : ""}`.trim();
}

export function Review({ replay, tick, selected, onJump, onSelect }: Props) {
  const end = matchEndTick(replay);
  const name = selected != null ? (replay.players[selected]?.name ?? "Player") : null;
  const review = useMemo(
    () => (selected != null ? playerReview(replay, selected, end) : null),
    [replay, selected, end],
  );
  const live = liveClutch(replay, tick);
  const showLive = live != null && selected != null && live.player === selected;

  if (selected == null || !name || !review) {
    return (
      <div className="review">
        <p className="tab-hint">Select a player on the scoreboard or radar to see their review.</p>
      </div>
    );
  }

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{name}</strong> — openings, clutches, and mistakes.
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
          <ul className="review-notes">
            {review.notes.map((n) => (
              <li key={`${n.tick}-${n.title}`}>
                <button
                  type="button"
                  className={noteClass(n.severity, n.tick > tick)}
                  onClick={() => onJump(n.tick)}
                >
                  <span className="pill review-round">{n.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title">{n.title}</span>
                    <span className="review-detail">{n.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
