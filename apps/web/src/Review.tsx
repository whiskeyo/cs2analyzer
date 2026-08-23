import { useMemo } from "react";
import { findExecutes } from "./execute";
import { playerReview } from "./review";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
}

export function Review({ replay, tick, selected, onJump }: Props) {
  const executes = useMemo(() => findExecutes(replay), [replay]);
  const name = selected != null ? (replay.players[selected]?.name ?? "Player") : null;
  const review = selected != null ? playerReview(replay, selected, tick) : null;

  return (
    <div className="review">
      <p className="tab-hint">
        Executes skip the default and jump to site hits, plants, and retakes. <kbd>e</kbd> /{" "}
        <kbd>E</kbd> next/prev.
      </p>
      {executes.length === 0 ? (
        <p className="muted tab-hint">
          No executes found — need a util dump, plant, or a 3k burst.
        </p>
      ) : (
        <ul className="review-notes">
          {executes.map((b) => {
            const live =
              tick >= b.tick && tick <= b.actionTick + (replay.header.tick_rate || 64) * 8;
            return (
              <li key={`${b.actionTick}-${b.kind}`}>
                <button
                  type="button"
                  className={`review-note ${b.kind}${live ? " on" : ""}`}
                  onClick={() => onJump(b.tick)}
                >
                  <span className="pill review-round">{b.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title">{b.title}</span>
                    <span className="review-detail">{b.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected == null && (
        <p className="muted tab-hint">Select a player for openings, clutches, and mistakes.</p>
      )}
      {name && review && (
        <>
          <p className="tab-hint">
            <strong>{name}</strong> — openings, clutches, and mistakes through this tick.
          </p>
          {review.headlines.length === 0 && review.notes.length === 0 ? (
            <p className="muted tab-hint">
              No player notes yet. Skip further in, then check again.
            </p>
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
        </>
      )}
    </div>
  );
}
