import type { TeamReviewItem } from "../teamReview";
import {
  firstEnemyKill,
  plural,
  teamDetail,
  teamHeadline,
  teamNote,
  weWonOpening,
} from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Won the opening duel but still lost the round. */
export const openingFailed: TeamReviewItem = {
  create() {
    let count = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost || !weWonOpening(ctx)) return;
        const first = firstEnemyKill(ctx);
        if (first == null) return;
        count += 1;
        const line = `Won opening vs ${ctx.playerName(first.victim)}, still lost`;
        details.push(teamDetail(ctx, first.tick, line));
        return [teamNote(ctx, first.tick, "opening", "high", "Won opening, lost round", line)];
      },
      headlines() {
        return teamHeadline(
          count,
          "high",
          "opening",
          `Won opening, lost ${count} ${plural(count, "round", "rounds")}`,
          details,
        );
      },
    };
  },
};
