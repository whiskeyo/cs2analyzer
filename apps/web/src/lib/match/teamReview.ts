import type { Kill, Replay, Round, Side } from "@/lib/replay/replayTypes";
import type { EconomyBuy } from "./economy";
import { finishReview, type PlayerReview, type ReviewHeadline, type ReviewNote } from "./review";
import { TEAM_REVIEW_ITEMS } from "./teamReviewItems";
import { teamRoundContext } from "./teamReviewItems/context";

export type { ReviewHeadline, ReviewNote };
export { TEAM_REVIEW_ITEMS } from "./teamReviewItems";

/** Same shape as player review — headlines + jumpable notes. */
export type TeamReview = PlayerReview;

export interface TeamRoundReviewContext {
  replay: Replay;
  untilTick: number;
  round: Round;
  roundKills: Kill[];
  freeze: number;
  /** Starting side of the roster being reviewed (follows the team across swaps). */
  startSide: Side;
  /** Side this roster is playing in this round. */
  side: Side;
  teamName: string;
  buy: EconomyBuy | null;
  opponentBuy: EconomyBuy | null;
  teamLost: boolean;
  completed: boolean;
  playerName: (index: number) => string;
  isTeammate: (index: number) => boolean;
}

/** One pass of a team check. `create()` so tallies stay per `teamReview` call. */
export interface TeamReviewCollector {
  collectRound?(ctx: TeamRoundReviewContext): ReviewNote[] | void;
  headlines(): ReviewHeadline[];
}

export interface TeamReviewItem {
  create(): TeamReviewCollector;
}

/** Economy, man-advantage, and util notes for one starting side through `untilTick`. */
export function teamReview(replay: Replay, startSide: Side, untilTick: number): TeamReview {
  const collectors = TEAM_REVIEW_ITEMS.map((item) => item.create());
  const notes: ReviewNote[] = [];

  for (const round of replay.rounds) {
    const ctx = teamRoundContext(replay, startSide, untilTick, round);
    if (ctx == null) continue;

    for (const collector of collectors) {
      const extra = collector.collectRound?.(ctx);
      if (extra) notes.push(...extra);
    }
  }

  return finishReview(replay, collectors, notes);
}
