import { HUD_TICK_INTERVAL_MS } from "@/lib/shared/constants";

/**
 * Whether the playback clock should commit a new React `tick`.
 *
 * `tickRef` always moves; this only gates HUD / scoreboard / `computeStats`.
 * User jumps, pause, and round/demo ends pass `immediate` so the scrubber
 * and freeze UI snap. During play, publish at `HUD_TICK_HZ` (or when freeze
 * ends so the countdown does not linger for a full interval).
 */
export function shouldPublishHudTick(args: {
  publishedTick: number;
  nextTick: number;
  lastPublishMs: number;
  nowMs: number;
  immediate: boolean;
  freezeEndTick?: number | null;
}): boolean {
  const floor = Math.floor(args.nextTick);
  const published = Math.floor(args.publishedTick);
  if (floor === published) {
    return false;
  }
  if (args.immediate) {
    return true;
  }
  const freezeEnd = args.freezeEndTick;
  if (freezeEnd != null && published < freezeEnd && floor >= freezeEnd) {
    return true;
  }
  return args.nowMs - args.lastPublishMs >= HUD_TICK_INTERVAL_MS;
}
