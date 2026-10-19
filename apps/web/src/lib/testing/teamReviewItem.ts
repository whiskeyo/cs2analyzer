import type { ReviewHeadline, ReviewNote } from "@/lib/match/review";
import { reviewJumpTick } from "@/lib/match/roundEvents";
import type { TeamReviewItem, TeamRoundReviewContext } from "@/lib/match/teamReview";
import { teamRoundContext } from "@/lib/match/teamReviewItems/context";
import type { Replay, Side } from "@/lib/replay/replayTypes";

/** First competitive round team context, or throw when the collector would skip it. */
export function mustTeamRoundContext(
  replay: Replay,
  startSide: Side = "CT",
  untilTick = replay.rounds[0]?.end_tick ?? 0,
  round = replay.rounds[0],
): TeamRoundReviewContext {
  const ctx = teamRoundContext(replay, startSide, untilTick, round);
  if (ctx == null) throw new Error("teamRoundContext returned null");
  return ctx;
}

function withLeadIn(
  replay: Replay,
  notes: ReviewNote[],
  headlines: ReviewHeadline[],
): { notes: ReviewNote[]; headlines: ReviewHeadline[] } {
  return {
    notes: notes.map((note) => ({ ...note, tick: reviewJumpTick(replay, note.tick) })),
    headlines: headlines.map((headline) => {
      if (headline.details == null || headline.details.length === 0) return headline;
      return {
        ...headline,
        details: headline.details.map((detail) => ({
          ...detail,
          tick: reviewJumpTick(replay, detail.tick),
        })),
      };
    }),
  };
}

/** One team collector against a synthetic replay: round notes + headlines. */
export function playTeamReviewItem(
  item: TeamReviewItem,
  replay: Replay,
  startSide: Side = "CT",
  untilTick = replay.rounds[0]?.end_tick ?? 0,
): {
  ctx: TeamRoundReviewContext;
  notes: ReviewNote[];
  headlines: ReviewHeadline[];
} {
  const ctx = mustTeamRoundContext(replay, startSide, untilTick);
  const collector = item.create();
  const notes = collector.collectRound?.(ctx) ?? [];
  const led = withLeadIn(replay, notes, collector.headlines());
  return { ctx, notes: led.notes, headlines: led.headlines };
}
