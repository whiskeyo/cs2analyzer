import type {
  DeathDraft,
  ReviewHeadline,
  ReviewItem,
  ReviewNote,
  RoundReviewContext,
} from "@/lib/match/review";
import { deathContext, roundContext } from "@/lib/match/reviewItems/context";
import type { Replay } from "@/lib/replay/replayTypes";

/** First competitive round context, or throw when the collector would skip it. */
export function mustRoundContext(
  replay: Replay,
  player = 0,
  untilTick = replay.rounds[0]?.end_tick ?? 0,
  round = replay.rounds[0],
): RoundReviewContext {
  const ctx = roundContext(replay, player, untilTick, round);
  if (ctx == null) throw new Error("roundContext returned null");
  return ctx;
}

/** One collector against a synthetic replay: death drafts, round notes, headlines. */
export function playReviewItem(
  item: ReviewItem,
  replay: Replay,
  player = 0,
  untilTick = replay.rounds[0]?.end_tick ?? 0,
): {
  ctx: RoundReviewContext;
  drafts: DeathDraft[];
  notes: ReviewNote[];
  headlines: ReviewHeadline[];
} {
  const ctx = mustRoundContext(replay, player, untilTick);
  const collector = item.create();
  const drafts: DeathDraft[] = [];
  for (const kill of ctx.myDeaths) {
    if (kill.attacker === player) continue;
    const draft: DeathDraft = { bits: [], severity: "low" };
    collector.applyDeath?.(deathContext(ctx, kill), draft);
    drafts.push(draft);
  }
  const notes = collector.collectRound?.(ctx) ?? [];
  return { ctx, drafts, notes, headlines: collector.headlines() };
}
