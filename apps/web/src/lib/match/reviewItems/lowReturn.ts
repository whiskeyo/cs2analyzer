import type { ReviewItem } from "../review";
import { atLeastMid, countHeadline, dmgTo, isUtil, plural } from "./support";

/** Gunfight return damage below this counts as almost no damage back. */
const LOW_RETURN_DAMAGE = 25;

export const lowReturn: ReviewItem = {
  create() {
    let noReturn = 0;
    return {
      applyDeath(ctx, draft) {
        if (ctx.kill.attacker < 0 || isUtil(ctx.kill.weapon)) return;
        const dealt = dmgTo(
          ctx.replay,
          ctx.player,
          ctx.kill.attacker,
          ctx.round.freeze_end_tick,
          ctx.kill.tick,
        );
        if (dealt >= LOW_RETURN_DAMAGE) return;
        noReturn += 1;
        draft.bits.push(dealt > 0 ? `only ${dealt} dmg back` : "no damage back");
        atLeastMid(draft);
      },
      headlines() {
        return countHeadline(
          noReturn,
          "mid",
          "death",
          `${noReturn} ${plural(noReturn, "gunfight", "gunfights")} with almost no damage back`,
        );
      },
    };
  },
};
