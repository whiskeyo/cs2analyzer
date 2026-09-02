import { prettyWeapon } from "@/lib/weapons/weapons";
import type { ReviewItem } from "../review";
import { countHeadline, goodNote, plural } from "./support";

export const openingWin: ReviewItem = {
  create() {
    let wins = 0;
    return {
      collectRound(ctx) {
        const first = ctx.first;
        if (!first || first.attacker !== ctx.player || !ctx.completed) return;
        wins += 1;
        return [
          goodNote(
            ctx,
            first.tick,
            "opening",
            `Won the opening vs ${ctx.playerName(first.victim)}`,
            prettyWeapon(first.weapon) + (first.headshot ? " HS" : ""),
          ),
        ];
      },
      headlines() {
        return countHeadline(
          wins,
          "good",
          "opening",
          `Won ${wins} opening ${plural(wins, "duel", "duels")}`,
        );
      },
    };
  },
};
