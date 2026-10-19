import { clutchAttempts } from "@/lib/match/clutches";
import type { TeamReviewItem } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Opponent won a clutch — we conceded a 1vX. */
export const clutchConceded: TeamReviewItem = {
  create() {
    let count = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost) return;
        const clutch = clutchAttempts(ctx.replay, ctx.untilTick).find(
          (c) => c.round === ctx.round.number && c.won && c.side !== ctx.side,
        );
        if (clutch == null) return;
        count += 1;
        const line = `Conceded ${clutch.name} 1v${clutch.vs}`;
        details.push(teamDetail(ctx, clutch.tick, line));
        return [teamNote(ctx, clutch.tick, "clutch", "high", "Conceded a clutch", line)];
      },
      headlines() {
        return teamHeadline(
          count,
          "high",
          "clutch",
          `Conceded ${count} ${plural(count, "clutch", "clutches")}`,
          details,
        );
      },
    };
  },
};
