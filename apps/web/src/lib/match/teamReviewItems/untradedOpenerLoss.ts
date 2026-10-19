import type { TeamReviewItem } from "../teamReview";
import {
  firstEnemyKill,
  plural,
  teamDetail,
  teamHeadline,
  teamNote,
  traded,
  weLostOpening,
} from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** First death was a teammate, untraded, and the round was lost. */
export const untradedOpenerLoss: TeamReviewItem = {
  create() {
    let count = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost || !weLostOpening(ctx)) return;
        const first = firstEnemyKill(ctx);
        if (first == null) return;
        if (traded(ctx.replay, first, ctx.untilTick)) return;
        count += 1;
        const line = `Untraded opener — ${ctx.playerName(first.victim)} died to ${ctx.playerName(first.attacker)}`;
        details.push(teamDetail(ctx, first.tick, line));
        return [teamNote(ctx, first.tick, "death", "high", "Untraded opener, lost", line)];
      },
      headlines() {
        return teamHeadline(
          count,
          "high",
          "death",
          `Lost ${count} after untraded ${plural(count, "opener", "openers")}`,
          details,
        );
      },
    };
  },
};
