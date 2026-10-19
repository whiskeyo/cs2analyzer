import { isPistolRoundNumber } from "@/lib/parse/roundTags";
import type { TeamReviewItem } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Pistol round wins and losses (regulation R1 / R13). */
export const pistolRound: TeamReviewItem = {
  create() {
    let wins = 0;
    let losses = 0;
    const winDetails: ReviewHeadlineDetail[] = [];
    const lossDetails: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !isPistolRoundNumber(ctx.round.number)) return;
        if (ctx.round.winner == null) return;
        const won = ctx.round.winner === ctx.side;
        if (won) {
          wins += 1;
          const line = `Won pistol`;
          winDetails.push(teamDetail(ctx, ctx.freeze, line));
          return [teamNote(ctx, ctx.freeze, "eco", "good", "Won pistol", line)];
        }
        losses += 1;
        const line = `Lost pistol`;
        lossDetails.push(teamDetail(ctx, ctx.freeze, line));
        return [teamNote(ctx, ctx.freeze, "eco", "high", "Lost pistol", line)];
      },
      headlines() {
        return [
          ...teamHeadline(
            wins,
            "good",
            "eco",
            `Won ${wins} pistol ${plural(wins, "round", "rounds")}`,
            winDetails,
          ),
          ...teamHeadline(
            losses,
            "high",
            "eco",
            `Lost ${losses} pistol ${plural(losses, "round", "rounds")}`,
            lossDetails,
          ),
        ];
      },
    };
  },
};
