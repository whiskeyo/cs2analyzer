import type { ReviewItem } from "../review";
import { atLeastMid, countHeadline, plural } from "./support";

const FED_MULTI_FRAGS = 3;

export const fedMulti: ReviewItem = {
  create() {
    let fed = 0;
    return {
      applyDeath(ctx, draft) {
        if (ctx.kill.attacker < 0) return;
        const killerKills = ctx.roundKills.filter((x) => x.attacker === ctx.kill.attacker).length;
        if (killerKills < FED_MULTI_FRAGS) return;
        fed += 1;
        draft.bits.push(`fed a ${killerKills}k`);
        atLeastMid(draft);
      },
      headlines() {
        return countHeadline(
          fed,
          "mid",
          "death",
          `Fed ${fed} ${plural(fed, "multi-kill", "multi-kills")}`,
        );
      },
    };
  },
};
