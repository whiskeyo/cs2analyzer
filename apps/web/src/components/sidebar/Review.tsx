import { useMemo } from "react";
import { useMessages } from "@/lib/i18n";
import { liveClutch } from "@/lib/match/clutches";
import { playerReview } from "@/lib/match/review";
import { matchEndTick } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { ReviewNoteFlow } from "./ReviewNoteFlow";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
}

export function Review({ replay, tick, selected, onJump, onSelect }: Props) {
  const { messages, t, tNodes } = useMessages();
  const end = matchEndTick(replay);
  const name = selected != null ? (replay.players[selected]?.name ?? messages.drop.player) : null;
  const review = useMemo(
    () => (selected != null ? playerReview(replay, selected, end) : null),
    [replay, selected, end],
  );
  const live = liveClutch(replay, tick);
  const showLive = live != null && selected != null && live.player === selected;

  if (selected == null || !name || !review) {
    return (
      <div className="review">
        <p className="tab-hint">{messages.sidebar.reviewEmpty}</p>
      </div>
    );
  }

  return (
    <div className="review">
      <p className="tab-hint">
        {tNodes(messages.sidebar.reviewHeader, { name: <strong>{name}</strong> })}
      </p>
      {showLive && live && (
        <button
          type="button"
          className="review-note on"
          onClick={() => {
            onSelect(live.player);
            onJump(live.tick);
          }}
        >
          <span className="pill review-round">{messages.sidebar.reviewLive}</span>
          <span className="review-copy">
            <span className="review-title">
              {t(messages.hud.clutch, { name: live.name, count: live.vs })}
            </span>
            <span className="review-detail">
              {t(messages.sidebar.reviewLiveDetail, { side: live.side })}
            </span>
          </span>
        </button>
      )}
      {review.headlines.length === 0 && review.notes.length === 0 && !showLive ? (
        <p className="muted tab-hint">{messages.sidebar.reviewNoNotes}</p>
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
          <ReviewNoteFlow
            notes={review.notes}
            pendingAtTick={tick}
            onJump={(note) => onJump(note.tick)}
          />
        </>
      )}
    </div>
  );
}
