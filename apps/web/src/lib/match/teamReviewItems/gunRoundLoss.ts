import { ECONOMY_BUY_LABEL } from "@/lib/match/economy";
import type { TeamReviewItem } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Lost a full-buy vs full-buy gun round. */
export const gunRoundLoss: TeamReviewItem = {
  create() {
    let count = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost) return;
        if (ctx.buy !== "full" || ctx.opponentBuy !== "full") return;
        count += 1;
        const line = `Lost full vs full`;
        details.push(teamDetail(ctx, ctx.freeze, line));
        return [
          teamNote(
            ctx,
            ctx.freeze,
            "eco",
            "high",
            "Lost a gun round",
            `${ECONOMY_BUY_LABEL.full} vs ${ECONOMY_BUY_LABEL.full}`,
          ),
        ];
      },
      headlines() {
        return teamHeadline(
          count,
          "high",
          "eco",
          `Lost ${count} gun ${plural(count, "round", "rounds")}`,
          details,
        );
      },
    };
  },
};
