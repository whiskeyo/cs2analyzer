import type { Kill, Replay } from "@/lib/replay/replayTypes";
import { KILL_FEED_MAX_ROWS, KILL_FEED_SECONDS, tickRate } from "@/lib/shared/constants";
import { recentKills } from "@/lib/stats/stats";

/**
 * Rows the page kill feed and the clip both paint.
 * `recentKills` walks newest-first and then flips to oldest-first.
 * The feed shows the newest frag on top, matching CS2.
 */
export function visibleKillFeed(replay: Replay, tick: number): Kill[] {
  const rate = tickRate(replay);
  return recentKills(replay, tick, rate * KILL_FEED_SECONDS, KILL_FEED_MAX_ROWS)
    .slice()
    .reverse();
}
