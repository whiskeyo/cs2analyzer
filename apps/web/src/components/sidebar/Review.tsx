import { useMemo } from "react";
import { liveClutch } from "@/lib/match/clutches";
import {
  notesOutsideHeadlines,
  playerReview,
  reviewDetailRoundCount,
  type ReviewHeadline,
} from "@/lib/match/review";
import { reviewHeadshotLine } from "@/lib/match/reviewHeadshot";
import { plural } from "@/lib/match/reviewItems/support";
import { teamReview } from "@/lib/match/teamReview";
import { computeStats, matchEndTick } from "@/lib/stats/stats";
import type { Replay, Side } from "@/lib/replay/replayTypes";
import { ReviewNoteFlow } from "./ReviewNoteFlow";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  reviewTeamSide: Side | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
  onSelectTeam: (side: Side) => void;
}

function startingTeamName(replay: Replay, startSide: Side): string {
  const named = startSide === "CT" ? replay.header.team_ct : replay.header.team_t;
  if (named && named.trim() !== "") return named;
  return startSide;
}

function ReviewHeads({
  headlines,
  pendingAtTick,
  onJump,
}: {
  headlines: ReviewHeadline[];
  pendingAtTick: number;
  onJump: (tick: number) => void;
}) {
  if (headlines.length === 0) return null;
  return (
    <ul className="review-heads">
      {headlines.map((h) => {
        const details = h.details ?? [];
        if (details.length === 0) {
          return (
            <li key={h.text} className={`review-head ${h.severity}`}>
              <div className="review-head-title">{h.text}</div>
            </li>
          );
        }
        const rounds = reviewDetailRoundCount(details);
        return (
          <li key={h.text} className={`review-head ${h.severity}`}>
            <details className="review-head-spoiler">
              <summary className="review-head-title">
                {h.text}
                <span className="review-head-hint muted">
                  {" "}
                  · {rounds} {plural(rounds, "round", "rounds")}
                </span>
              </summary>
              <ul className="review-head-details">
                {details.map((detail, i) => (
                  <li key={`${detail.tick}-${detail.roundLabel}-${i}`}>
                    <button
                      type="button"
                      className={`review-note ${h.severity}${
                        detail.tick > pendingAtTick ? " pending" : ""
                      }`}
                      onClick={() => onJump(detail.tick)}
                    >
                      <span className="pill review-round">{detail.roundLabel}</span>
                      <span className="review-copy">
                        <span className="review-detail">{detail.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function Review({
  replay,
  tick,
  selected,
  reviewTeamSide,
  onJump,
  onSelect,
  onSelectTeam,
}: Props) {
  const end = matchEndTick(replay);
  const name = selected != null ? (replay.players[selected]?.name ?? "Player") : null;
  const teamA = startingTeamName(replay, "CT");
  const teamB = startingTeamName(replay, "T");
  const teamName = reviewTeamSide != null ? startingTeamName(replay, reviewTeamSide) : null;

  const showTeam = reviewTeamSide != null;
  const showPlayer = !showTeam && selected != null && name != null;

  const review = useMemo(() => {
    if (showTeam && reviewTeamSide != null) return teamReview(replay, reviewTeamSide, end);
    if (showPlayer && selected != null) return playerReview(replay, selected, end);
    return null;
  }, [replay, selected, end, showTeam, showPlayer, reviewTeamSide]);

  const leftoverNotes = useMemo(() => {
    if (!showPlayer || review == null) return [];
    return notesOutsideHeadlines(review.headlines, review.notes);
  }, [showPlayer, review]);

  const hsLine = useMemo(() => {
    if (!showPlayer || selected == null) return null;
    return reviewHeadshotLine(computeStats(replay, end)[selected]);
  }, [replay, selected, end, showPlayer]);

  const live = liveClutch(replay, tick);
  const showLive = showPlayer && live != null && selected != null && live.player === selected;

  const subject = showTeam ? (teamName ?? "Team") : name;
  const hint = showTeam
    ? " — economy, openings, clutches, post-plant, and util."
    : showPlayer
      ? " — openings, clutches, and mistakes."
      : null;

  const teamEmpty = showTeam && review != null && review.headlines.length === 0 && !showLive;
  const playerEmpty =
    showPlayer &&
    review != null &&
    review.headlines.length === 0 &&
    review.notes.length === 0 &&
    !showLive;

  return (
    <div className="review">
      <div className="filters" role="toolbar" aria-label="Review team">
        <button
          type="button"
          className={`filter${reviewTeamSide === "CT" ? " on" : ""}`}
          onClick={() => onSelectTeam("CT")}
        >
          {teamA}
        </button>
        <button
          type="button"
          className={`filter${reviewTeamSide === "T" ? " on" : ""}`}
          onClick={() => onSelectTeam("T")}
        >
          {teamB}
        </button>
      </div>
      {!showTeam && !showPlayer ? (
        <p className="tab-hint">
          Select a player on the scoreboard or radar to see their review. To see the team review,
          select{" "}
          <button type="button" className="link" onClick={() => onSelectTeam("CT")}>
            {teamA}
          </button>{" "}
          or{" "}
          <button type="button" className="link" onClick={() => onSelectTeam("T")}>
            {teamB}
          </button>
          .
        </p>
      ) : (
        <>
          <p className="tab-hint">
            <strong>{subject}</strong>
            {hsLine ? ` · ${hsLine}` : ""}
            {hint}
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
              <span className="pill review-round">Live</span>
              <span className="review-copy">
                <span className="review-title">
                  {live.name} 1v{live.vs}
                </span>
                <span className="review-detail">in progress · {live.side}</span>
              </span>
            </button>
          )}
          {teamEmpty || playerEmpty ? (
            <p className="muted tab-hint">
              {showTeam ? "No team notes in this match." : "No player notes in this match."}
            </p>
          ) : review != null ? (
            <>
              <ReviewHeads headlines={review.headlines} pendingAtTick={tick} onJump={onJump} />
              {showPlayer && leftoverNotes.length > 0 && (
                <ReviewNoteFlow
                  notes={leftoverNotes}
                  pendingAtTick={tick}
                  onJump={(note) => onJump(note.tick)}
                />
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
