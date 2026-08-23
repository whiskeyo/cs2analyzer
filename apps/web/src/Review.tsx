import { playerReview } from "./review";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
}

export function Review({ replay, tick, selected, onJump }: Props) {
  if (selected == null) {
    return (
      <p className="muted tab-hint">
        Select a player on the map or scoreboard to see what went wrong for them through this tick.
      </p>
    );
  }
  const name = replay.players[selected]?.name ?? "Player";
  const review = playerReview(replay, selected, tick);
  if (review.headlines.length === 0 && review.notes.length === 0) {
    return (
      <p className="muted tab-hint">
        No deaths for {name} yet in this demo. Play or skip further in, then check again.
      </p>
    );
  }
  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{name}</strong> — event-based review through this tick. Click a line to jump there.
      </p>
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
            <button type="button" className={`review-note ${n.severity}`} onClick={() => onJump(n.tick)}>
              <span className="pill review-round">{n.roundLabel}</span>
              <span className="review-copy">
                <span className="review-title">{n.title}</span>
                <span className="review-detail">{n.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
