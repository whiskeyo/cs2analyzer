import type { ReviewItem } from "../review";

/** Annotates a death with "round lost"; no headline of its own. */
export const roundLost: ReviewItem = {
  create() {
    return {
      applyDeath(ctx, draft) {
        if (ctx.teamLost) draft.bits.push("round lost");
      },
      headlines() {
        return [];
      },
    };
  },
};
