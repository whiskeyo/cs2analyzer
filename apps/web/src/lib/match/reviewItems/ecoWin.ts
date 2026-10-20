import { isPistolRound, regulationHalfRosters } from "@/lib/match/pistol";
import { ECO_MAX_EQUIPMENT } from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import type { ReviewItem } from "../review";
import { countHeadline, goodNote, plural } from "./support";

export const ecoWin: ReviewItem = {
  create() {
    let wins = 0;
    return {
      collectRound(ctx) {
        const me = samplePlayers(ctx.replay, ctx.freeze).find((p) => p.index === ctx.player);
        if (
          isPistolRound(ctx.round.number, ctx.replay.match_info, {
            tick: ctx.freeze,
            rounds: regulationHalfRosters(ctx.replay),
          }) ||
          !me ||
          me.equip >= ECO_MAX_EQUIPMENT ||
          !ctx.completed ||
          ctx.round.winner !== ctx.side
        ) {
          return;
        }
        wins += 1;
        return [goodNote(ctx, ctx.freeze, "eco", "Won the round on an eco", `eq $${me.equip}`)];
      },
      headlines() {
        return countHeadline(
          wins,
          "good",
          "eco",
          `Won ${wins} eco ${plural(wins, "round", "rounds")}`,
        );
      },
    };
  },
};
