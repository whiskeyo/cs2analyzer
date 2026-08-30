import type { ReactNode } from "react";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import { formatScorecard, type MatchHalfScore, type MatchScorecard } from "@/lib/stats/stats";

const WIN_COLOR = "#6ecf8a";
const LOSS_COLOR = "#e07070";

function halfCtT(half: MatchHalfScore): { ct: number; t: number } {
  return {
    ct: half.ct ?? half.a,
    t: half.t ?? half.b,
  };
}

function HalfScore({ half }: { half: MatchHalfScore }) {
  const { ct, t } = halfCtT(half);
  return (
    <>
      <span style={{ color: CT_COLOR }}>{ct}</span>
      <span>:</span>
      <span style={{ color: T_COLOR }}>{t}</span>
    </>
  );
}

interface Props {
  mapLabel: string;
  scorecard: MatchScorecard;
}

/** Saved-note title with CT/T half colors and green/red match result. */
export function ScorecardLabel({ mapLabel, scorecard }: Props) {
  const aWon = scorecard.scoreA > scorecard.scoreB;
  const bWon = scorecard.scoreB > scorecard.scoreA;
  const scoreAColor = aWon ? WIN_COLOR : bWon ? LOSS_COLOR : undefined;
  const scoreBColor = bWon ? WIN_COLOR : aWon ? LOSS_COLOR : undefined;

  const halves: ReactNode[] = [];
  if (scorecard.firstHalf) {
    halves.push(<HalfScore key="h1" half={scorecard.firstHalf} />);
  }
  if (scorecard.secondHalf) {
    halves.push(<HalfScore key="h2" half={scorecard.secondHalf} />);
  }
  if (scorecard.overtime) {
    halves.push(
      <span key="ot">
        OT {scorecard.overtime.a}:{scorecard.overtime.b}
      </span>,
    );
  }

  return (
    <span className="scorecard-label" aria-label={`${mapLabel}: ${formatScorecard(scorecard)}`}>
      {mapLabel}: {scorecard.teamA} - {scorecard.teamB},{" "}
      <span style={scoreAColor ? { color: scoreAColor } : undefined}>{scorecard.scoreA}</span>:
      <span style={scoreBColor ? { color: scoreBColor } : undefined}>{scorecard.scoreB}</span>
      {halves.length > 0 && (
        <>
          {" ("}
          {halves.map((part, i) => (
            <span key={i}>
              {i > 0 ? ", " : ""}
              {part}
            </span>
          ))}
          )
        </>
      )}
    </span>
  );
}
