import { currentRound } from "@/lib/replay/sample";
import type { BuyEvent, Replay } from "@/lib/replay/replayTypes";

/** Freeze cart for one pawn, hidden once the round is live. */
export function freezeBuysForPlayer(replay: Replay, player: number, tick: number): BuyEvent[] {
  const round = currentRound(replay, tick);
  if (!round || tick >= round.freeze_end_tick) return [];
  return replay.buyEvents.filter(
    (e) => e.player === player && e.tick >= round.start_tick && e.tick <= tick,
  );
}
