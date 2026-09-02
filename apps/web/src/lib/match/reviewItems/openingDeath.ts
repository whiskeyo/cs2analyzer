import type { ReviewItem } from "../review";
import { countHeadline, plural, setHigh } from "./support";

export const openingDeath: ReviewItem = {
  create() {
    let opening = 0;
    let openingLoss = 0;
    return {
      applyDeath(ctx, draft) {
        if (!ctx.openingDeath) return;
        opening += 1;
        draft.bits.push("opening death");
        setHigh(draft);
        if (ctx.teamLost) openingLoss += 1;
      },
      headlines() {
        const duels = `Lost ${opening} opening ${plural(opening, "duel", "duels")}`;
        return countHeadline(
          opening,
          "high",
          "opening",
          openingLoss > 0 ? `${duels} (${openingLoss} in rounds the team lost)` : duels,
        );
      },
    };
  },
};
