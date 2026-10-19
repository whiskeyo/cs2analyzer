import type { TeamReviewItem } from "../teamReview";
import { firstEnemyKill, teamDetail, teamHeadline, teamNote, weLostOpening } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Lost the opening duel but still won the round. */
export const openingRecovered: TeamReviewItem = {
  create() {
    let count = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || ctx.teamLost || ctx.round.winner !== ctx.side) return;
        if (!weLostOpening(ctx)) return;
        const first = firstEnemyKill(ctx);
        if (first == null) return;
        count += 1;
        const line = `Lost opening to ${ctx.playerName(first.attacker)}, still won`;
        details.push(teamDetail(ctx, first.tick, line));
        return [teamNote(ctx, first.tick, "opening", "good", "Lost opening, won round", line)];
      },
      headlines() {
        return teamHeadline(
          count,
          "good",
          "opening",
          `Recovered ${count} after losing the opening`,
          details,
        );
      },
    };
  },
};
