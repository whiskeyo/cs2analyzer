import type { Kill, Replay, Round, Side } from "@/lib/replay/replayTypes";
import { REVIEW_ITEMS } from "./reviewItems";
import { deathContext, deathNote, roundContext } from "./reviewItems/context";

export { REVIEW_ITEMS } from "./reviewItems";

export type ReviewSeverity = "good" | "high" | "mid" | "low";

export type ReviewKind = "opening" | "clutch" | "death" | "multi" | "eco";

export interface ReviewHeadline {
  text: string;
  severity: ReviewSeverity;
  count: number;
  kind: ReviewKind;
}

export interface ReviewNote {
  tick: number;
  roundLabel: string;
  title: string;
  detail: string;
  severity: ReviewSeverity;
  kind: ReviewKind;
}

export interface PlayerReview {
  headlines: ReviewHeadline[];
  notes: ReviewNote[];
}

export interface RoundReviewContext {
  replay: Replay;
  player: number;
  untilTick: number;
  round: Round;
  roundKills: Kill[];
  first: Kill | undefined;
  myDeaths: Kill[];
  side: Side;
  teamLost: boolean;
  completed: boolean;
  freeze: number;
  playerName: (index: number) => string;
}

export interface DeathReviewContext extends RoundReviewContext {
  kill: Kill;
  pre: number;
  openingDeath: boolean;
  clutchDeath: boolean;
  enemies: number;
}

export interface DeathDraft {
  bits: string[];
  severity: ReviewSeverity;
}

/** One pass of a review check. `create()` so tallies stay per `playerReview` call. */
export interface ReviewCollector {
  applyDeath?(ctx: DeathReviewContext, draft: DeathDraft): void;
  collectRound?(ctx: RoundReviewContext): ReviewNote[] | void;
  headlines(): ReviewHeadline[];
}

export interface ReviewItem {
  create(): ReviewCollector;
}

const SEVERITY_RANK: Record<ReviewSeverity, number> = { good: 0, high: 1, mid: 2, low: 3 };

/** Worst first when the note list is sorted by severity. */
const NOTE_SEVERITY_RANK: Record<ReviewSeverity, number> = { high: 0, mid: 1, low: 2, good: 3 };

export type ReviewNoteSort = "round" | "severity";

export function sortReviewNotes<T extends ReviewNote>(
  notes: readonly T[],
  sort: ReviewNoteSort,
): T[] {
  const copy = notes.slice();
  if (sort === "round") {
    copy.sort((a, b) => a.tick - b.tick);
    return copy;
  }
  copy.sort(
    (a, b) => NOTE_SEVERITY_RANK[a.severity] - NOTE_SEVERITY_RANK[b.severity] || a.tick - b.tick,
  );
  return copy;
}

/** Headlines stay good-then-bad. Stored notes stay in tick order. */
export function finishReview(collectors: ReviewCollector[], notes: ReviewNote[]): PlayerReview {
  const headlines = collectors.flatMap((collector) => collector.headlines());
  headlines.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count,
  );
  notes.sort((a, b) => a.tick - b.tick);
  return { headlines, notes };
}

/** Openings, clutches, ecos, and death notes for one player through `untilTick`. */
export function playerReview(replay: Replay, player: number, untilTick: number): PlayerReview {
  const collectors = REVIEW_ITEMS.map((item) => item.create());
  const notes: ReviewNote[] = [];

  for (const round of replay.rounds) {
    const ctx = roundContext(replay, player, untilTick, round);
    if (ctx == null) continue;

    for (const kill of ctx.myDeaths) {
      if (kill.attacker === ctx.player) continue;
      const death = deathContext(ctx, kill);
      const draft: DeathDraft = { bits: [], severity: "low" };
      for (const collector of collectors) collector.applyDeath?.(death, draft);
      notes.push(deathNote(death, draft));
    }

    for (const collector of collectors) {
      const extra = collector.collectRound?.(ctx);
      if (extra) notes.push(...extra);
    }
  }

  return finishReview(collectors, notes);
}
