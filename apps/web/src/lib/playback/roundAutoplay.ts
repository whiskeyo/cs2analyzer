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

export function roundPlaybackFallback(replay: Replay): {
  min: number;
  max: number;
} {
  const ticks = replay.ticks.ticks;
  return {
    min: ticks[0] ?? 0,
    max: replay.header.playback_ticks || ticks[ticks.length - 1] || 0,
  };
}

/** Live start of a round — freeze end, never before `start_tick`. */
export function roundJumpTick(round: Round): number {
  return Math.max(round.freeze_end_tick, round.start_tick);
}

/** Keep the playhead inside the given (or inferred) round scrub range. */
export function clampTickToRound(replay: Replay, tick: number, round?: Round | null): number {
  const r = round ?? currentRound(replay, tick);
  if (!r) return tick;
  const { min, max } = roundScrubRange(r, replay.rounds, roundPlaybackFallback(replay));
  return Math.min(max, Math.max(min, tick));
}

/** Land on the live start of `round`. Do not re-clamp via currentRound. */
export function jumpToRound(_replay: Replay, round: Round): number {
  return roundJumpTick(round);
}

export interface RoundEndAdvance {
  tick: number;
  playing: boolean;
  /** Set when autoplay moved into the next round. */
  nextRound?: Round;
}

/** Forward playback at or past the active round's scrub max. */
export function advanceAtRoundEnd(
  tick: number,
  replay: Replay,
  autoplay: boolean,
  pinnedRound?: Round | null,
): RoundEndAdvance | null {
  const round = pinnedRound ?? currentRound(replay, tick);
  if (!round) {
    return null;
  }
  const { min, max: roundMax } = roundScrubRange(
    round,
    replay.rounds,
    roundPlaybackFallback(replay),
  );
  if (tick < roundMax) {
    return null;
  }
  // Just landed on this round's live start.
  if (tick <= min) {
    return null;
  }
  const idx = replay.rounds.indexOf(round);
  const next = idx >= 0 ? replay.rounds[idx + 1] : undefined;
  // Already inside a later round — do not snap back to this round's last tick.
  if (next && tick >= next.start_tick) {
    return null;
  }
  if (autoplay && next) {
    return { tick: roundJumpTick(next), playing: true, nextRound: next };
  }
  // Pause in place. Assigning `roundMax` yanks backward when the inferred
  // round is the previous one and the playhead is already on the next freeze.
  return { tick, playing: false };
}
