import { useMemo } from "react";
import { tickRate } from "./constants";
import { groupOverlays, overlayJumpTick } from "./overlay";
import { roundClock } from "./roundEvents";
import type { Replay, Stroke } from "./types";

interface Props {
  replay: Replay;
  strokes: Stroke[];
  onJump: (tick: number) => void;
}

export function Notes({ replay, strokes, onJump }: Props) {
  const groups = useMemo(() => groupOverlays(strokes), [strokes]);
  const tps = tickRate(replay);

  if (groups.length === 0) {
    return (
      <p className="muted tab-hint">Draw or add a text box on the radar. Use Moment to time it.</p>
    );
  }

  return (
    <div className="review">
      <p className="tab-hint">Your notes on this match. Click a row to jump there.</p>
      {groups.map((g) => {
        const rnd = replay.rounds.find((r) => r.number === g.round);
        const jump = rnd ? overlayJumpTick(strokes, rnd) : 0;
        return (
          <div key={g.round} className="notes-round">
            <p className="notes-round-label">{rnd?.is_knife ? "Knife" : `Round ${g.round}`}</p>
            <ul className="review-notes">
              {g.texts.map((t, i) => {
                const at = t.start_tick ?? rnd?.freeze_end_tick ?? rnd?.start_tick ?? 0;
                const clock = rnd ? roundClock(rnd, at, tps) : "";
                return (
                  <li key={`${g.round}-text-${i}-${at}`}>
                    <button type="button" className="review-note" onClick={() => onJump(at)}>
                      <span className="pill review-round">{clock || `R${g.round}`}</span>
                      <span className="review-copy">
                        <span className="review-title">{t.text}</span>
                        <span className="review-detail">
                          {t.start_tick != null ? "Moment" : "Whole round"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {g.drawings > 0 && (
                <li>
                  <button type="button" className="review-note" onClick={() => onJump(jump)}>
                    <span className="pill review-round">R{g.round}</span>
                    <span className="review-copy">
                      <span className="review-title">
                        {g.drawings} {g.drawings === 1 ? "drawing" : "drawings"}
                      </span>
                      <span className="review-detail">pen and arrows</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
