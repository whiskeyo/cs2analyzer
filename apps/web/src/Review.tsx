import { playerReview } from "./review";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
}

export function Review({ replay, tick, selected, onJump }: Props) {
  const name = selected != null ? (replay.players[selected]?.name ?? "Player") : null;
  const review = selected != null ? playerReview(replay, selected, tick) : null;

  if (selected == null || !name || !review) {
    return (
      <p className="muted tab-hint">
        Select a player on the map or scoreboard for openings, clutches, and mistakes through this
        tick.
      </p>
    );
  }

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{name}</strong> — openings, clutches, and mistakes through this tick.
      </p>
      {review.headlines.length === 0 && review.notes.length === 0 ? (
        <p className="muted tab-hint">No player notes yet. Skip further in, then check again.</p>
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
                  className={`review-note ${n.severity}`}
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
