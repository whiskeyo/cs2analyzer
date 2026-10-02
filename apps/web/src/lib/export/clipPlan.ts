import {
  CLIP_EXPORT_BITRATE_1080,
  CLIP_EXPORT_BITRATE_1440,
  CLIP_EXPORT_FPS_DEFAULT,
  CLIP_EXPORT_MAX_SECONDS,
  CLIP_EXPORT_REALTIME_HINT,
  CLIP_EXPORT_SIZE_HIGH,
  CLIP_KILL_AFTER_SECONDS,
  CLIP_KILL_BEFORE_SECONDS,
  CLIP_POST_ROUND_TAIL_SECONDS,
  CLIP_SITE_ENTRY_LEAD_SECONDS,
} from "@/lib/export/constants";
import {
  clipFrameClock,
  clipRangeIssue,
  type ClipFrameClock,
  type ClipSpan,
} from "@/lib/export/radarClip";

export interface ClipRoundClock {
  start_tick: number;
  freeze_end_tick: number;
  end_tick: number;
  /** First `cs_pre_restart` after the win. 0 when the demo did not record one. */
  playback_end_tick?: number;
}

/**
 * Live round, freeze excluded. `end_tick` is the win-status flip
 * (`m_iRoundWinStatus`), not the next freeze. Site entry and post-plant
 * stop here. Full round and around-kill use {@link clipRoundCover}.
 */
export function clipRoundBounds(round: ClipRoundClock): ClipSpan {
  const startTick = Math.max(round.freeze_end_tick, round.start_tick);
  const endTick = Math.max(round.end_tick, startTick);
  return { startTick, endTick };
}

/** Next round's freeze start, or null on the last round. */
export function clipNextRoundStart(
  rounds: readonly { start_tick: number; freeze_end_tick: number }[],
  roundIndex: number,
): number | null {
  const next = roundIndex >= 0 ? rounds[roundIndex + 1] : undefined;
  if (!next) return null;
  if (next.start_tick > 0) return next.start_tick;
  return next.freeze_end_tick > 0 ? next.freeze_end_tick : null;
}

/**
 * Last tick included in a full-round or around-kill clip.
 * `playback_end_tick` is the end of the win panel. When it is 0, keep three
 * seconds after the win. Either way the last tick is at most one before the
 * next round, or the demo end on the last round.
 */
export function clipCoverLastTick(
  round: ClipRoundClock,
  rate: number,
  nextStartTick: number | null,
  demoEndTick: number,
  tailSeconds = CLIP_POST_ROUND_TAIL_SECONDS,
): number {
  const win = round.end_tick;
  const playbackEnd = round.playback_end_tick ?? 0;
  const tail = rate > 0 ? win + tailSeconds * rate : win;
  let last = playbackEnd > 0 ? playbackEnd : tail;
  if (nextStartTick != null && nextStartTick > 0) {
    last = Math.min(last, nextStartTick - 1);
  } else if (demoEndTick > 0) {
    last = Math.min(last, demoEndTick);
  }
  return Math.max(last, win);
}

/**
 * Live round plus the post-round window. `endTick` is exclusive: the tick
 * after {@link clipCoverLastTick}, and never the next round's `start_tick`.
 */
export function clipRoundCover(
  round: ClipRoundClock,
  rate: number,
  nextStartTick: number | null,
  demoEndTick: number,
): ClipSpan {
  const live = clipRoundBounds(round);
  const last = clipCoverLastTick(round, rate, nextStartTick, demoEndTick);
  let endTick = last + 1;
  if (nextStartTick != null && nextStartTick > 0) {
    endTick = Math.min(endTick, nextStartTick);
  }
  return { startTick: live.startTick, endTick: Math.max(endTick, live.startTick) };
}

export function clampClipSpan(span: ClipSpan, bounds: ClipSpan): ClipSpan {
  const startTick = Math.min(bounds.endTick, Math.max(bounds.startTick, span.startTick));
  const endTick = Math.min(bounds.endTick, Math.max(startTick, span.endTick));
  return { startTick, endTick };
}

export function fullRoundSpan(bounds: ClipSpan): ClipSpan {
  return { startTick: bounds.startTick, endTick: bounds.endTick };
}

/**
 * A few seconds before the execute's action tick, through the plant.
 * Without a plant the window runs to round end. No detected execute → null.
 */
export function siteEntrySpan(
  bounds: ClipSpan,
  executeActionTick: number | null,
  plantTick: number | null,
  rate: number,
  leadSeconds = CLIP_SITE_ENTRY_LEAD_SECONDS,
): ClipSpan | null {
  if (executeActionTick == null || !(rate > 0)) return null;
  const span = clampClipSpan(
    {
      startTick: executeActionTick - leadSeconds * rate,
      endTick: plantTick ?? bounds.endTick,
    },
    bounds,
  );
  if (!(span.endTick > span.startTick)) return null;
  return span;
}

/** Plant through round end. Rounds without a plant (or an empty window) return null. */
export function postPlantSpan(bounds: ClipSpan, plantTick: number | null): ClipSpan | null {
  if (plantTick == null) return null;
  const span = clampClipSpan({ startTick: plantTick, endTick: bounds.endTick }, bounds);
  if (!(span.endTick > span.startTick)) return null;
  return span;
}

/** About 5s before a kill through 3s after, clamped to the round. */
export function aroundKillSpan(
  bounds: ClipSpan,
  killTick: number,
  rate: number,
  beforeSeconds = CLIP_KILL_BEFORE_SECONDS,
  afterSeconds = CLIP_KILL_AFTER_SECONDS,
): ClipSpan | null {
  if (!(rate > 0)) return null;
  const span = clampClipSpan(
    {
      startTick: killTick - beforeSeconds * rate,
      endTick: killTick + afterSeconds * rate,
    },
    bounds,
  );
  if (!(span.endTick > span.startTick)) return null;
  return span;
}

export function firstExecuteActionTick(
  beats: readonly { round: number; kind: string; actionTick: number }[],
  roundNumber: number,
): number | null {
  let best: number | null = null;
  for (const beat of beats) {
    if (beat.round !== roundNumber || beat.kind !== "execute") continue;
    if (best == null || beat.actionTick < best) best = beat.actionTick;
  }
  return best;
}

export function plantTickInRound(
  events: readonly { tick: number; kind: string }[],
  round: { start_tick: number; end_tick: number },
): number | null {
  for (const event of events) {
    if (event.kind !== "planted") continue;
    if (event.tick >= round.start_tick && event.tick <= round.end_tick) return event.tick;
  }
  return null;
}

/**
 * Kills from round start through the clip's last tick.
 * `clipEndTick` is the cover's exclusive end, so a frag on the next round's
 * start stays out. The winning kill on `end_tick` stays in.
 */
export function killsInRound<T extends { tick: number }>(
  kills: readonly T[],
  round: { start_tick: number; end_tick: number },
  clipEndTick = round.end_tick + 1,
): T[] {
  const end = Math.max(round.end_tick + 1, clipEndTick);
  return kills.filter((kill) => kill.tick >= round.start_tick && kill.tick < end);
}

export function nearestKillTick(kills: readonly { tick: number }[], tick: number): number | null {
  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const kill of kills) {
    const dist = Math.abs(kill.tick - tick);
    if (dist < bestDist) {
      best = kill.tick;
      bestDist = dist;
    }
  }
  return best;
}

export type ClipEncodePath = "webcodecs" | "media-recorder";

export interface ClipEncodeCapabilities {
  /** `VideoEncoder` exists. */
  videoEncoder: boolean;
  /** `VideoEncoder.isConfigSupported` accepted an H.264 config for this export. */
  h264: boolean;
  mediaRecorderMime: string | null;
}

/**
 * Offline H.264 when the browser can encode it. Otherwise the real-time
 * recorder, when that exists. Neither → the clip cannot be saved.
 */
export function selectClipEncodePath(caps: ClipEncodeCapabilities): ClipEncodePath | null {
  if (caps.videoEncoder && caps.h264) return "webcodecs";
  if (caps.mediaRecorderMime) return "media-recorder";
  return null;
}

export function clipExportMaxSeconds(path: ClipEncodePath | null): number | null {
  return path === "media-recorder" ? CLIP_EXPORT_MAX_SECONDS : null;
}

export function clipExportBitrate(size: number, fps: number): number {
  const base = size >= CLIP_EXPORT_SIZE_HIGH ? CLIP_EXPORT_BITRATE_1440 : CLIP_EXPORT_BITRATE_1080;
  const scale = fps > 0 ? fps / CLIP_EXPORT_FPS_DEFAULT : 1;
  return Math.round(base * scale);
}

export function clipExportHint(path: ClipEncodePath, size: number, fps: number): string {
  if (path === "media-recorder") return CLIP_EXPORT_REALTIME_HINT;
  return `${size}×${size} · ${fps} fps · encoded on this device`;
}

/** Frame count is duration × fps. Timestamps partition the demo span. */
export function clipFrameSchedule(span: ClipSpan, rate: number, fps: number): ClipFrameClock {
  return clipFrameClock(span, rate, fps);
}

export function clipSpanIssue(
  span: ClipSpan,
  rate: number,
  path: ClipEncodePath | null,
): ReturnType<typeof clipRangeIssue> {
  return clipRangeIssue(span, rate, clipExportMaxSeconds(path));
}
