import type { Kill, Replay } from "@/lib/replay/replayTypes";
import { KILL_FEED_MAX_ROWS, KILL_FEED_SECONDS, tickRate } from "@/lib/shared/constants";
import { recentKills } from "@/lib/stats/stats";

/** World, fall, and suicide rows. C4 is separate so a bomb still uses the bomb icon. */
export type EnvironmentDeath = "bomb" | "skull";

function isBombWeapon(weapon: string): boolean {
  return weapon === "c4" || weapon === "planted_c4" || weapon.endsWith("_c4");
}

function isSkullWeapon(weapon: string): boolean {
  return (
    weapon === "world" ||
    weapon === "suicide" ||
    weapon === "fall" ||
    weapon.includes("trigger_hurt")
  );
}

/**
 * Deaths with no killer name: the feed shows an icon and the victim.
 * A C4 kill keeps the bomb icon even when a player planted it.
 */
export function environmentDeath(kill: Kill): EnvironmentDeath | null {
  const weapon = kill.weapon.toLowerCase();
  if (isBombWeapon(weapon)) return "bomb";
  if (kill.attacker < 0 || kill.attacker === kill.victim || isSkullWeapon(weapon)) return "skull";
  return null;
}

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
