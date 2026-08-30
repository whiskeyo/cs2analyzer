import { useMemo, useState } from "react";
import type { ReviewSeverity } from "@/lib/match/review";
import type { SeriesPlayerReviewResult } from "@/lib/parse/seriesPlayerReview";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";

type Tone = "all" | "good" | "bad";

function isGood(severity: ReviewSeverity): boolean {
  return severity === "good";
}

interface Props {
  review: SeriesPlayerReviewResult;
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

/** Cross-demo player review with per-game grouping and jump targets. */
export function SeriesPlayerReview({ review, onJump }: Props) {
  const [tone, setTone] = useState<Tone>("all");

  const headlines = useMemo(() => {
    if (tone === "all") return review.headlines;
    return review.headlines.filter((h) => (tone === "good") === isGood(h.severity));
  }, [review.headlines, tone]);

  const notesByDemo = useMemo(() => {
    if (tone === "all") return review.notesByDemo;
    return review.notesByDemo
      .map((group) => ({
        ...group,
        notes: group.notes.filter((n) => (tone === "good") === isGood(n.severity)),
      }))
      .filter((group) => group.notes.length > 0);
  }, [review.notesByDemo, tone]);

  const noteCount = notesByDemo.reduce((n, g) => n + g.notes.length, 0);

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{review.playerName}</strong> — mistakes and highlights across {review.demoCount}{" "}
        demos.
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
      {headlines.length === 0 && noteCount === 0 ? (
        <p className="muted tab-hint">
          {tone === "all"
            ? "No player notes across the series."
            : `No ${tone} plays across the series.`}
        </p>
      ) : (
        <>
          {headlines.length > 0 && (
            <ul className="review-heads">
              {headlines.map((h) => (
                <li key={`${h.severity}|${h.text}`} className={`review-head ${h.severity}`}>
                  <span>{h.text}</span>
                  {h.byDemo.length > 0 && (
                    <ul className="series-review-breakdown">
                      {h.byDemo.map((demo) => (
                        <li key={demo.demoId} className="series-review-demo-chip">
                          {demo.fileName} ×{demo.count}
                          {demo.rounds.length > 0 ? ` (${demo.rounds.join(", ")})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {notesByDemo.map((group) => (
            <section key={group.demoId} className="series-review-demo">
              <h3 className="series-review-demo-head">
                {group.fileName}
                <span className="muted"> · {group.notes.length} notes</span>
              </h3>
              <ul className="review-notes">
                {group.notes.map((n) => (
                  <li key={`${n.demoId}-${n.tick}-${n.title}`}>
                    <button
                      type="button"
                      className={`review-note ${n.severity}`}
                      onClick={() => onJump({ demoId: n.demoId, jumpTick: n.jumpTick })}
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
            </section>
          ))}
        </>
      )}
    </div>
  );
}
