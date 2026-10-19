import { isEnemyKill } from "@/lib/stats/combat";
import type { Kill } from "@/lib/replay/replayTypes";
import type { TeamReviewItem, TeamRoundReviewContext } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/**
 * Flash leave-hand tick so finishReview lead-in lands before the throw.
 * Falls back to the kill when the demo has no matching flash projectile.
 */
export function flashAssistEventTick(ctx: TeamRoundReviewContext, kill: Kill): number {
  return latestFlashThrowStart(ctx, kill) ?? kill.tick;
}

function latestFlashThrowStart(ctx: TeamRoundReviewContext, kill: Kill): number | null {
  let best: number | null = null;
  for (const g of ctx.replay.grenades) {
    if (g.kind !== "flash" || g.thrower !== kill.assister) continue;
    if (g.start_tick < ctx.round.freeze_end_tick || g.start_tick > kill.tick) continue;
    if (best == null || g.start_tick > best) best = g.start_tick;
  }
  return best;
}

/** Teammate flash assists on enemy kills. */
export const flashAssist: TeamReviewItem = {
  create() {
    let assists = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        const notes = [];
        for (const kill of ctx.roundKills) {
          if (!kill.assisted_flash || kill.assister < 0) continue;
          if (!isEnemyKill(ctx.replay, kill)) continue;
          if (!ctx.isTeammate(kill.assister) || !ctx.isTeammate(kill.attacker)) continue;
          assists += 1;
          const flasher = ctx.playerName(kill.assister);
          const killer = ctx.playerName(kill.attacker);
          const victim = ctx.playerName(kill.victim);
          const line = `Flash assist by ${flasher}, leading to ${killer} → ${victim} kill`;
          const eventTick = flashAssistEventTick(ctx, kill);
          details.push(teamDetail(ctx, eventTick, line));
          notes.push(teamNote(ctx, eventTick, "util", "good", `Flash assist by ${flasher}`, line));
        }
        return notes;
      },
      headlines() {
        return teamHeadline(
          assists,
          "good",
          "util",
          `${assists} flash ${plural(assists, "assist", "assists")}`,
          details,
        );
      },
    };
  },
};
