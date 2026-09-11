import type { ReactNode } from "react";
import { useMessages } from "@/lib/i18n/useMessages";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import { formatScorecard, type MatchHalfScore, type MatchScorecard } from "@/lib/stats/stats";

const WIN_COLOR = "#6ecf8a";
const LOSS_COLOR = "#e07070";

/** Color for starting-side slot `a` (started CT) / `b` (started T) per half. */
function halfSlotColor(slot: "a" | "b", half: "first" | "second"): string {
  if (half === "first") return slot === "a" ? CT_COLOR : T_COLOR;
  return slot === "a" ? T_COLOR : CT_COLOR;
}

/** Half line: slot `a`/`b` wins with CT:T (H1) or T:CT (H2) side colors. */
function HalfScore({ half, which }: { half: MatchHalfScore; which: "first" | "second" }) {
  return (
    <>
      <span style={{ color: halfSlotColor("a", which) }}>{half.a}</span>
      <span>:</span>
      <span style={{ color: halfSlotColor("b", which) }}>{half.b}</span>
    </>
  );
}

interface Props {
  mapLabel: string;
  scorecard: MatchScorecard;
}

/** Saved-note title with CT/T half colors and green/red match result. */
export function ScorecardLabel({ mapLabel, scorecard }: Props) {
  const { messages, t } = useMessages();
  const aWon = scorecard.scoreA > scorecard.scoreB;
  const bWon = scorecard.scoreB > scorecard.scoreA;
  const scoreAColor = aWon ? WIN_COLOR : bWon ? LOSS_COLOR : undefined;
  const scoreBColor = bWon ? WIN_COLOR : aWon ? LOSS_COLOR : undefined;

  const halves: ReactNode[] = [];
  if (scorecard.firstHalf) {
    halves.push(<HalfScore key="h1" half={scorecard.firstHalf} which="first" />);
  }
  if (scorecard.secondHalf) {
    halves.push(<HalfScore key="h2" half={scorecard.secondHalf} which="second" />);
  }
  if (scorecard.overtime) {
    halves.push(
      <span key="ot">
        {t(messages.headerMeta.overtime, { a: scorecard.overtime.a, b: scorecard.overtime.b })}
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
