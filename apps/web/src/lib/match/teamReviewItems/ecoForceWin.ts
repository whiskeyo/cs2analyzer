import { ECONOMY_BUY_LABEL, type EconomyBuy } from "@/lib/match/economy";
import type { TeamReviewItem } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/** Won while on an eco or force buy (non-pistol). */
export const ecoForceWin: TeamReviewItem = {
  create() {
    let wins = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || ctx.round.winner !== ctx.side) return;
        if (ctx.buy !== "eco" && ctx.buy !== "force") return;
        wins += 1;
        const label = ECONOMY_BUY_LABEL[ctx.buy].toLowerCase();
        const title = `Won on ${ctx.buy === "eco" ? "an" : "a"} ${label}`;
        const line = `${title} ${vsBuy(ctx.opponentBuy)}`;
        details.push(teamDetail(ctx, ctx.freeze, line));
        return [teamNote(ctx, ctx.freeze, "eco", "good", title, vsBuy(ctx.opponentBuy))];
      },
      headlines() {
        return teamHeadline(
          wins,
          "good",
          "eco",
          `Won ${wins} eco/force ${plural(wins, "round", "rounds")}`,
          details,
        );
      },
    };
  },
};

function vsBuy(buy: EconomyBuy | null): string {
  if (buy == null) return "vs unknown buy";
  return `vs ${ECONOMY_BUY_LABEL[buy]}`;
}
