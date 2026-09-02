import { prettyWeapon } from "@/lib/weapons/weapons";
import type { ReviewItem } from "../review";
import { atLeastMid, countHeadline, isUtil, plural } from "./support";

export const utilDeath: ReviewItem = {
  create() {
    let utilDeaths = 0;
    return {
      applyDeath(ctx, draft) {
        if (!isUtil(ctx.kill.weapon)) return;
        utilDeaths += 1;
        draft.bits.push(`died to ${prettyWeapon(ctx.kill.weapon)}`);
        atLeastMid(draft);
      },
      headlines() {
        return countHeadline(
          utilDeaths,
          "mid",
          "death",
          `Died to utility ${utilDeaths} ${plural(utilDeaths, "time", "times")}`,
        );
      },
    };
  },
};
