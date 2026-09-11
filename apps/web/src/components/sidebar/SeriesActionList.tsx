import { useMessages } from "@/lib/i18n/useMessages";
import type { SeriesActionBeatRow } from "@/lib/parse/seriesAnalysis";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";

interface Props {
  beats: SeriesActionBeatRow[];
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

/** Cross-demo execute beats for the habits bucket. */
export function SeriesActionList({ beats, onJump }: Props) {
  const { messages, t } = useMessages();
  return (
    <div className="review">
      <p className="tab-hint">
        {t(messages.sidebar.seriesActionHeader, {
          count: new Set(beats.map((b) => b.demoId)).size,
        })}
      </p>
      {beats.length === 0 ? (
        <p className="muted tab-hint">{messages.sidebar.seriesActionEmpty}</p>
      ) : (
        <ul className="review-notes">
          {beats.map((row) => (
            <li key={`${row.demoId}-${row.beat.actionTick}-${row.beat.kind}`}>
              <button
                type="button"
                className={`review-note ${row.beat.kind}`}
                onClick={() => onJump({ demoId: row.demoId, jumpTick: row.jumpTick })}
              >
                <span className="pill review-round">{row.beat.roundLabel}</span>
                <span className="review-copy">
                  <span className="review-title">
                    {row.fileName} · {row.title}
                  </span>
                  <span className="review-detail">{row.beat.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
