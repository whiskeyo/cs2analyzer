import { useMemo } from "react";
import { findExecutes } from "./execute";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
}

export function Action({ replay, tick, onJump }: Props) {
  const executes = useMemo(() => findExecutes(replay), [replay]);

  return (
    <div className="review">
      <p className="tab-hint">
        Site hits, plants, and retakes — skip the default. <kbd>e</kbd> / <kbd>E</kbd> next/prev.
      </p>
      {executes.length === 0 ? (
        <p className="muted tab-hint">
          No actions found — need a clustered util dump, plant, or a 3k burst.
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
    </div>
  );
}
