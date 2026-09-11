import { useMessages } from "@/lib/i18n/useMessages";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";
import type { SeriesPlayerReviewResult } from "@/lib/parse/seriesPlayerReview";
import { ReviewNoteFlow } from "./ReviewNoteFlow";

interface Props {
  review: SeriesPlayerReviewResult;
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

/** Cross-demo player review with per-game grouping and jump targets. */
export function SeriesPlayerReview({ review, onJump }: Props) {
  const { messages, t, tNodes } = useMessages();
  const noteCount = review.notesByDemo.reduce((n, g) => n + g.notes.length, 0);

  return (
    <div className="review">
      <p className="tab-hint">
        {tNodes(messages.sidebar.seriesReviewHeader, {
          name: <strong>{review.playerName}</strong>,
          count: review.demoCount,
        })}
      </p>
      {review.headlines.length === 0 && noteCount === 0 ? (
        <p className="muted tab-hint">{messages.sidebar.seriesReviewEmpty}</p>
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
                <span className="muted">
                  {t(messages.sidebar.seriesDemoNotes, { count: group.notes.length })}
                </span>
              </h3>
              <ReviewNoteFlow
                notes={group.notes}
                onJump={(note) => onJump({ demoId: note.demoId, jumpTick: note.jumpTick })}
              />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
