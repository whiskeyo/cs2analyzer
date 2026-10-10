import { currentRound } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { isEnemyKill, isSuicide } from "./combat";

export interface RoundFrags {
  /** Enemy kills by this player in the current round up to `tick`. */
  count: number;
  /** Whether the latest of those kills was a headshot (icon choice). */
  headshot: boolean;
}

/**
 * Live multi-kill chip for the HUD: frags in the active round only.
 * Window matches scoreboard round kills (`freeze_end` … playhead).
 */
export function playerRoundFrags(replay: Replay, tick: number, player: number): RoundFrags | null {
  if (player < 0 || player >= replay.players.length) return null;
  const round = currentRound(replay, tick);
  if (!round) return null;
  const from = round.freeze_end_tick;
  let count = 0;
  let headshot = false;
  for (const k of replay.kills) {
    if (k.tick < from || k.tick > tick) continue;
    if (k.attacker !== player) continue;
    if (isSuicide(k) || !isEnemyKill(replay, k)) continue;
    count += 1;
    headshot = k.headshot;
  }
  if (count === 0) return null;
  return { count, headshot };
}
