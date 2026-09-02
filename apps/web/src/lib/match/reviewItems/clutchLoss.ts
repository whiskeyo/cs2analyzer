import type { ReviewItem } from "../review";
import { countHeadline, plural, setHigh } from "./support";

export const clutchLoss: ReviewItem = {
  create() {
    let losses = 0;
    return {
      applyDeath(ctx, draft) {
        if (!ctx.clutchDeath) return;
        losses += 1;
        draft.bits.push(`lost 1v${ctx.enemies}`);
        setHigh(draft);
      },
      headlines() {
        return countHeadline(
          losses,
          "high",
          "clutch",
          `Lost ${losses} ${plural(losses, "clutch", "clutches")}`,
        );
      },
    };
  },
};
