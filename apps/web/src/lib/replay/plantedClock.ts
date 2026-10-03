import { currentRound } from "@/lib/replay/sample";
import type { BombEvent, Replay, Round } from "@/lib/replay/replayTypes";
import { BOMB_SECONDS, C4_CLOCK_DECIMALS, tickRate } from "@/lib/shared/constants";
import { roundTimeRemaining } from "@/lib/stats/hud";
import { formatClock } from "@/lib/weapons/weapons";

export interface PlantedClock {
  clockLabel: string;
  clockKind: "bomb";
  /** Unclamped fuse. Negative means the 40s timer has already run out. */
  remaining: number;
  stopped: "defused" | "exploded" | null;
}

/** `C4 12.3` from a fuse reading. Zero stays `C4 0.0`. The word C4 is not localized. */
export function c4ClockLabel(seconds: number): string {
  return `C4 ${Math.max(0, seconds).toFixed(C4_CLOCK_DECIMALS)}`;
}

/**
 * Fuse readout after `bomb_planted` in this round.
 * A fake defuse (`begin_defuse` / `abort_defuse`) does not touch it.
 * `bomb_defused` freezes the reading from that tick, including when the event
 * lands on or after `round.end_tick` but before the next round starts.
 * `bomb_exploded` holds `C4 0.0`. Seeking back before the plant returns null
 * so the caller keeps the round clock. The next round has no plant yet.
 */
export function plantedClock(
  replay: Replay,
  round: Round,
  tick: number,
  rate: number,
): PlantedClock | null {
  if (!(rate > 0)) return null;
  let plantTick = -1;
  let stopped: PlantedClock["stopped"] = null;
  let frozen = 0;
  for (const event of replay.bombEvents) {
    if (event.tick > tick || !bombEventInRound(replay, round, event)) continue;
    if (event.kind === "planted") {
      plantTick = event.tick;
      stopped = null;
    } else if (event.kind === "defused" && plantTick >= 0 && event.tick >= plantTick) {
      stopped = "defused";
      frozen = BOMB_SECONDS - (event.tick - plantTick) / rate;
    } else if (event.kind === "exploded" && plantTick >= 0 && event.tick >= plantTick) {
      stopped = "exploded";
    }
  }
  if (plantTick < 0) return null;
  if (stopped === "exploded") {
    return { clockLabel: c4ClockLabel(0), clockKind: "bomb", remaining: 0, stopped };
  }
  if (stopped === "defused") {
    return { clockLabel: c4ClockLabel(frozen), clockKind: "bomb", remaining: frozen, stopped };
  }
  const remaining = BOMB_SECONDS - (tick - plantTick) / rate;
  return { clockLabel: c4ClockLabel(remaining), clockKind: "bomb", remaining, stopped: null };
}

/**
 * Single-demo playback clock.
 * Freeze (`Freeze 1.0s`) and the round countdown stay on the pre-plant formula.
 * After a plant the label is {@link plantedClock}, the same fuse the clip burns in.
 */
export function pageClockLabel(replay: Replay, tick: number): string {
  const round = currentRound(replay, tick);
  const rate = tickRate(replay);
  if (round && tick < round.freeze_end_tick) {
    const freezeLeft = (round.freeze_end_tick - tick) / rate;
    return `Freeze ${freezeLeft.toFixed(1)}s`;
  }
  if (round) {
    const planted = plantedClock(replay, round, tick, rate);
    if (planted) return planted.clockLabel;
  }
  const origin = round ? round.freeze_end_tick : (replay.ticks.ticks[0] ?? 0);
  const elapsed = rate > 0 ? Math.max(0, (tick - origin) / rate) : 0;
  return formatClock(roundTimeRemaining(elapsed, round?.round_time_s ?? 0));
}

/**
 * Plant stays inside the round. A defuse or explosion may be recorded on or
 * after `end_tick` (the win status often lands first). It still belongs to
 * this round until the next one starts. Missing the next round is not an error.
 */
function bombEventInRound(replay: Replay, round: Round, event: BombEvent): boolean {
  if (event.tick < round.start_tick) return false;
  if (event.tick <= round.end_tick) return true;
  if (event.kind !== "defused" && event.kind !== "exploded") return false;
  const next = nextRoundStart(replay, round);
  return next == null || event.tick < next;
}

function nextRoundStart(replay: Replay, round: Round): number | null {
  let next: number | null = null;
  for (const candidate of replay.rounds) {
    if (candidate.start_tick <= round.start_tick) continue;
    if (next == null || candidate.start_tick < next) next = candidate.start_tick;
  }
  return next;
}
