import type { TeamReviewItem } from "../teamReview";
import { peakManAdvantage, plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Lost a completed round after holding a man advantage at some point. */
export const manAdvantageLoss: TeamReviewItem = {
  create() {
    let losses = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost) return;
        const peak = peakManAdvantage(ctx);
        if (peak == null) return;
        losses += 1;
        const line = `Lost with a ${peak.us}v${peak.them} man advantage`;
        details.push(teamDetail(ctx, peak.tick, line));
        return [
          teamNote(
            ctx,
            peak.tick,
            "advantage",
            "high",
            `Lost with a ${peak.us}v${peak.them}`,
            "man advantage",
          ),
        ];
      },
      headlines() {
        return teamHeadline(
          losses,
          "high",
          "advantage",
          `Lost ${losses} with man ${plural(losses, "advantage", "advantages")}`,
          details,
        );
      },
    };
  },
};
