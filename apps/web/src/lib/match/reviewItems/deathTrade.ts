import type { ReviewItem } from "../review";
import { countHeadline, plural, traded } from "./support";

export const deathTrade: ReviewItem = {
  create() {
    let untraded = 0;
    return {
      applyDeath(ctx, draft) {
        const wasTraded = ctx.kill.attacker >= 0 && traded(ctx.replay, ctx.kill, ctx.untilTick);
        if (ctx.kill.attacker >= 0 && !wasTraded) {
          untraded += 1;
          draft.bits.push("untraded");
          if (draft.severity !== "high") draft.severity = "mid";
        } else if (ctx.openingDeath && wasTraded) {
          draft.bits.push("traded");
          if (draft.severity === "high") draft.severity = "mid";
        }
      },
      headlines() {
        return countHeadline(
          untraded,
          "mid",
          "death",
          `${untraded} untraded ${plural(untraded, "death", "deaths")}`,
        );
      },
    };
  },
};
