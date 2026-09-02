import { TRADE_SECONDS, tickRate } from "@/lib/shared/constants";
import { isEnemyKill } from "@/lib/stats/stats";
import { prettyWeapon } from "@/lib/weapons/weapons";
import type { ReviewItem } from "../review";
import { countHeadline, goodNote, plural } from "./support";

export const tradedOpener: ReviewItem = {
  create() {
    let trades = 0;
    return {
      collectRound(ctx) {
        const first = ctx.first;
        if (
          !first ||
          first.attacker === ctx.player ||
          first.victim === ctx.player ||
          !ctx.completed
        ) {
          return;
        }
        const window = Math.round(TRADE_SECONDS * tickRate(ctx.replay));
        const trade = ctx.roundKills.find(
          (k) =>
            isEnemyKill(ctx.replay, k) &&
            k.attacker === ctx.player &&
            k.victim === first.attacker &&
            k.tick > first.tick &&
            k.tick <= first.tick + window,
        );
        if (!trade) return;
        trades += 1;
        return [
          goodNote(
            ctx,
            trade.tick,
            "opening",
            `Traded the opener (${ctx.playerName(first.victim)})`,
            prettyWeapon(trade.weapon) + (trade.headshot ? " HS" : ""),
          ),
        ];
      },
      headlines() {
        return countHeadline(
          trades,
          "good",
          "opening",
          `Traded ${trades} ${plural(trades, "opener", "openers")}`,
        );
      },
    };
  },
};
