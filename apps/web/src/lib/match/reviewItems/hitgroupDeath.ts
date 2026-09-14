import { HITGROUP_GENERIC, HITGROUP_HEAD, hitgroupLabel } from "@/lib/shared/constants";
import type { Hurt, Replay } from "@/lib/replay/replayTypes";
import { isEnemy } from "@/lib/stats/combat";
import type { ReviewItem } from "../review";
import { countHeadline, plural } from "./support";

function enemyHurtsOn(replay: Replay, victim: number, from: number, to: number): Hurt[] {
  const out: Hurt[] = [];
  for (const h of replay.hurts ?? []) {
    if (h.tick < from || h.tick > to || h.victim !== victim || h.damage <= 0) {
      continue;
    }
    if (h.attacker < 0 || h.attacker === victim) {
      continue;
    }
    if (!isEnemy(replay, h.attacker, victim, h.tick)) {
      continue;
    }
    out.push(h);
  }
  return out;
}

function latestHurt(hurts: readonly Hurt[]): Hurt | null {
  let best: Hurt | null = null;
  for (const h of hurts) {
    if (!best || h.tick >= best.tick) {
      best = h;
    }
  }
  return best;
}

function headHits(hurts: readonly Hurt[]): number {
  let n = 0;
  for (const h of hurts) {
    if (h.hitgroup === HITGROUP_HEAD) {
      n += 1;
    }
  }
  return n;
}

/** Killing-blow hitgroup and earlier head tags from existing `Hurt` rows. */
export const hitgroupDeath: ReviewItem = {
  create() {
    let tagged = 0;
    return {
      applyDeath(ctx, draft) {
        if (ctx.kill.attacker < 0) {
          return;
        }
        const from = ctx.round.freeze_end_tick;
        const to = ctx.kill.tick;
        const taken = enemyHurtsOn(ctx.replay, ctx.player, from, to);
        const fromKiller = taken.filter((h) => h.attacker === ctx.kill.attacker);
        const killHurt = latestHurt(fromKiller);
        if (killHurt && killHurt.hitgroup !== HITGROUP_GENERIC) {
          draft.bits.push(hitgroupLabel(killHurt.hitgroup));
        }
        const heads = headHits(taken);
        const prior = killHurt?.hitgroup === HITGROUP_HEAD ? heads - 1 : heads;
        if (prior > 0) {
          draft.bits.push(prior === 1 ? "tagged in head" : `tagged in head ${prior} times`);
        }
        if (heads > 0) {
          tagged += 1;
        }
      },
      headlines() {
        return countHeadline(
          tagged,
          "low",
          "death",
          `Tagged in the head before ${tagged} ${plural(tagged, "death", "deaths")}`,
        );
      },
    };
  },
};
