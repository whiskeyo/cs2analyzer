import type { SeriesPlayerReviewResult } from "@/lib/parse/seriesPlayerReview";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";

interface Props {
  review: SeriesPlayerReviewResult;
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

/** Cross-demo player review with per-game grouping and jump targets. */
export function SeriesPlayerReview({ review, onJump }: Props) {
  const noteCount = review.notesByDemo.reduce((n, g) => n + g.notes.length, 0);

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{review.playerName}</strong> — mistakes and highlights across {review.demoCount}{" "}
        demos.
      </p>
      {review.headlines.length === 0 && noteCount === 0 ? (
        <p className="muted tab-hint">No player notes across the series.</p>
      ) : (
        <>
          {review.headlines.length > 0 && (
            <ul className="review-heads">
              {review.headlines.map((h) => (
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
          {review.notesByDemo.map((group) => (
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
