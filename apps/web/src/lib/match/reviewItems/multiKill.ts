import { isEnemyKill } from "@/lib/stats/stats";
import { prettyWeapon } from "@/lib/weapons/weapons";
import type { ReviewItem } from "../review";
import { countHeadline, goodNote, plural } from "./support";

const MULTI_KILL_FRAGS = 4;
const ACE_FRAGS = 5;

export const multiKill: ReviewItem = {
  create() {
    let rounds = 0;
    return {
      collectRound(ctx) {
        const myFrags = ctx.roundKills.filter(
          (k) => isEnemyKill(ctx.replay, k) && k.attacker === ctx.player,
        );
        if (myFrags.length < MULTI_KILL_FRAGS) return;
        rounds += 1;
        const last = myFrags[myFrags.length - 1];
        return [
          goodNote(
            ctx,
            last.tick,
            "multi",
            myFrags.length >= ACE_FRAGS ? "Ace" : `${myFrags.length}k this round`,
            myFrags.map((k) => prettyWeapon(k.weapon)).join(", "),
          ),
        ];
      },
      headlines() {
        return countHeadline(
          rounds,
          "good",
          "multi",
          `${rounds} ${plural(rounds, "round", "rounds")} with 4k+`,
        );
      },
    };
  },
};
