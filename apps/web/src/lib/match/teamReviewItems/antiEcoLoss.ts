import { ECONOMY_BUY_LABEL } from "@/lib/match/economy";
import type { TeamReviewItem } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Lost while on an anti-eco (force/full vs eco). */
export const antiEcoLoss: TeamReviewItem = {
  create() {
    let losses = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost || ctx.buy !== "anti-eco") return;
        losses += 1;
        const line = `Lost an anti-eco vs ${ECONOMY_BUY_LABEL.eco}`;
        details.push(teamDetail(ctx, ctx.freeze, line));
        return [teamNote(ctx, ctx.freeze, "eco", "high", "Lost an anti-eco", line)];
      },
      headlines() {
        return teamHeadline(
          losses,
          "high",
          "eco",
          `Lost ${losses} anti-eco ${plural(losses, "round", "rounds")}`,
          details,
        );
      },
    };
  },
};
