import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { roundScrubRange } from "./roundTimeline";

export const ROUND_AUTOPLAY_STORAGE_KEY = "cs2analyzer.roundAutoplay";

export function loadRoundAutoplay(): boolean {
  try {
    return localStorage.getItem(ROUND_AUTOPLAY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveRoundAutoplay(enabled: boolean): void {
  try {
    localStorage.setItem(ROUND_AUTOPLAY_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

export function roundPlaybackFallback(replay: Replay): { min: number; max: number } {
  const ticks = replay.ticks.ticks;
  return {
    min: ticks[0] ?? 0,
    max: replay.header.playback_ticks || ticks[ticks.length - 1] || 0,
  };
}

export function roundJumpTick(round: Round): number {
  return round.freeze_end_tick || round.start_tick;
}

export interface RoundEndAdvance {
  tick: number;
  playing: boolean;
}

/** Forward playback at or past the current round scrub max. */
export function advanceAtRoundEnd(
  tick: number,
  replay: Replay,
  autoplay: boolean,
): RoundEndAdvance | null {
  const round = currentRound(replay, tick);
  if (!round) {
    return null;
  }
  const { max: roundMax } = roundScrubRange(round, replay.rounds, roundPlaybackFallback(replay));
  if (tick < roundMax) {
    return null;
  }
  if (autoplay) {
    const idx = replay.rounds.findIndex((r) => r.start_tick === round.start_tick);
    const next = replay.rounds[idx + 1];
    if (next) {
      return { tick: roundJumpTick(next), playing: true };
    }
  }
  return { tick: roundMax, playing: false };
}
