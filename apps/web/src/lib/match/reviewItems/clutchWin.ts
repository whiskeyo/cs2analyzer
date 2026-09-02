import type { ReviewItem } from "../review";
import { clutchVs, countHeadline, goodNote, plural } from "./support";

export const clutchWin: ReviewItem = {
  create() {
    let wins = 0;
    return {
      collectRound(ctx) {
        if (!ctx.completed || ctx.round.winner !== ctx.side) return;
        const vs = clutchVs(ctx.replay, ctx.round, ctx.roundKills, ctx.player, ctx.side);
        if (vs < 1) return;
        wins += 1;
        const last = [...ctx.roundKills].reverse().find((k) => k.attacker === ctx.player);
        return [goodNote(ctx, last?.tick ?? ctx.freeze, "clutch", `Won a 1v${vs}`, "clutch")];
      },
      headlines() {
        return countHeadline(
          wins,
          "good",
          "clutch",
          `Won ${wins} ${plural(wins, "clutch", "clutches")}`,
        );
      },
    };
  },
};
