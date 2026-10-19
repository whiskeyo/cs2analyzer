import { samplePlayers } from "@/lib/replay/sample";
import { isEnemyKill } from "@/lib/stats/combat";
import type { Kill, Side } from "@/lib/replay/replayTypes";
import type {
  ReviewHeadline,
  ReviewHeadlineDetail,
  ReviewNote,
  ReviewSeverity,
  ReviewKind,
} from "../review";
import type { TeamRoundReviewContext } from "../teamReview";
import { plural, roundLabel, traded } from "../reviewItems/support";

export { plural, roundLabel, traded };
export type { ReviewHeadlineDetail };

/** First enemy kill of the round, if any. */
export function firstEnemyKill(ctx: TeamRoundReviewContext): Kill | undefined {
  return ctx.roundKills.find((k) => isEnemyKill(ctx.replay, k));
}

export function weWonOpening(ctx: TeamRoundReviewContext): boolean {
  const first = firstEnemyKill(ctx);
  return first != null && ctx.isTeammate(first.attacker);
}

export function weLostOpening(ctx: TeamRoundReviewContext): boolean {
  const first = firstEnemyKill(ctx);
  return first != null && ctx.isTeammate(first.victim);
}

export function teamNote(
  ctx: TeamRoundReviewContext,
  tick: number,
  kind: ReviewKind,
  severity: ReviewSeverity,
  title: string,
  detail: string,
): ReviewNote {
  return {
    tick,
    roundLabel: roundLabel(ctx.round),
    title,
    detail,
    severity,
    kind,
  };
}

export function teamDetail(
  ctx: TeamRoundReviewContext,
  tick: number,
  text: string,
): ReviewHeadlineDetail {
  return { tick, roundLabel: roundLabel(ctx.round), text };
}

/** Summary count plus clickable per-round detail lines. */
export function teamHeadline(
  count: number,
  severity: ReviewSeverity,
  kind: ReviewKind,
  summary: string,
  details: readonly ReviewHeadlineDetail[],
): ReviewHeadline[] {
  if (count <= 0) return [];
  return [{ count, severity, kind, text: summary, details: details.slice() }];
}

/**
 * Largest man advantage this side held in the round (us > them), with the tick
 * the advantage first reached that peak. Null if never ahead.
 */
export function peakManAdvantage(
  ctx: TeamRoundReviewContext,
): { us: number; them: number; tick: number } | null {
  const snap = samplePlayers(ctx.replay, ctx.freeze);
  const alive = new Set<number>();
  const sides = new Map<number, Side>();
  for (const p of snap) {
    if (!p.present || !p.alive) continue;
    alive.add(p.index);
    sides.set(p.index, p.ct ? "CT" : "T");
  }

  const count = (want: Side) => {
    let n = 0;
    for (const i of alive) if (sides.get(i) === want) n += 1;
    return n;
  };

  let peak: { us: number; them: number; tick: number } | null = null;
  const note = (tick: number) => {
    const us = count(ctx.side);
    const them = count(ctx.side === "CT" ? "T" : "CT");
    if (us <= them) return;
    if (
      peak == null ||
      us - them > peak.us - peak.them ||
      (us - them === peak.us - peak.them && us > peak.us)
    ) {
      peak = { us, them, tick };
    }
  };

  note(ctx.freeze);
  for (const kill of ctx.roundKills) {
    if (!isEnemyKill(ctx.replay, kill)) continue;
    if (kill.victim >= 0) alive.delete(kill.victim);
    note(kill.tick);
  }
  return peak;
}
