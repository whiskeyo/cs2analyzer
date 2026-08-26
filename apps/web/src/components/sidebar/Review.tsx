import { useMemo, useState } from "react";
import { type ReviewSeverity, matchHighlights, playerReview } from "@/lib/match/review";
import type { Replay } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
}

type Tone = "all" | "good" | "bad";

function isGood(severity: ReviewSeverity): boolean {
  return severity === "good";
}

export function Review({ replay, tick, selected, onJump, onSelect }: Props) {
  const [tone, setTone] = useState<Tone>("all");
  const name = selected != null ? (replay.players[selected]?.name ?? "Player") : null;
  const review = selected != null ? playerReview(replay, selected, tick) : null;
  const headlines = useMemo(() => {
    if (!review) return [];
    if (tone === "all") return review.headlines;
    return review.headlines.filter((h) => (tone === "good") === isGood(h.severity));
  }, [review, tone]);
  const notes = useMemo(() => {
    if (!review) return [];
    if (tone === "all") return review.notes;
    return review.notes.filter((n) => (tone === "good") === isGood(n.severity));
  }, [review, tone]);

  if (selected == null || !name || !review) {
    const highlights = matchHighlights(replay, tick);
    return (
      <div className="review">
        <p className="tab-hint">
          Match highlights through this tick. Select a player for their openings and mistakes.
        </p>
        {highlights.length === 0 ? (
          <p className="muted tab-hint">
            No clutch wins, eco wins, 4ks, or traded openers yet. Skip further in, then check again.
          </p>
        ) : (
          <ul className="review-notes">
            {highlights.map((n) => (
              <li key={`${n.tick}-${n.title}`}>
                <button
                  type="button"
                  className="review-note good"
                  onClick={() => {
                    if (n.player >= 0) onSelect(n.player);
                    onJump(n.tick);
                  }}
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
        )}
      </div>
    );
  }

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{name}</strong> — openings, clutches, and mistakes through this tick.
      </p>
      <div className="filters" role="toolbar" aria-label="Review filters">
        <button
          type="button"
          className={`filter${tone === "all" ? " on" : ""}`}
          onClick={() => setTone("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`filter${tone === "good" ? " on" : ""}`}
          onClick={() => setTone("good")}
        >
          Good
        </button>
        <button
          type="button"
          className={`filter${tone === "bad" ? " on" : ""}`}
          onClick={() => setTone("bad")}
        >
          Bad
        </button>
      </div>
      {headlines.length === 0 && notes.length === 0 ? (
        <p className="muted tab-hint">
          {tone === "all"
            ? "No player notes yet. Skip further in, then check again."
            : `No ${tone} plays through this tick.`}
        </p>
      ) : (
        <>
          {headlines.length > 0 && (
            <ul className="review-heads">
              {headlines.map((h) => (
                <li key={h.text} className={`review-head ${h.severity}`}>
                  {h.text}
                </li>
              ))}
            </ul>
          )}
          <ul className="review-notes">
            {notes.map((n) => (
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
