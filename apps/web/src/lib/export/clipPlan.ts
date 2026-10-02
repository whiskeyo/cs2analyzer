import {
  CLIP_EXPORT_BITRATE_1080,
  CLIP_EXPORT_BITRATE_1440,
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_SIZE_HIGH,
  CLIP_POST_ROUND_TAIL_SECONDS,
  clipExportFrameLabel,
} from "@/lib/export/constants";
import {
  clipFrameClock,
  clipRangeIssue,
  formatClipDuration,
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
 * (`m_iRoundWinStatus`), not the next freeze. Full round and post-plant
 * use {@link clipRoundCover}, which continues through the win panel.
 */
export function clipRoundBounds(round: ClipRoundClock): ClipSpan {
  const startTick = Math.max(round.freeze_end_tick, round.start_tick);
  const endTick = Math.max(round.end_tick, startTick);
  return { startTick, endTick };
}

/** Last element of the tick buffer, or 0 when nothing was recorded. */
export function clipSampleEndTick(ticks: ArrayLike<number>): number {
  if (ticks.length === 0) return 0;
  return ticks[ticks.length - 1] ?? 0;
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
 * Last tick included in a full-round clip.
 * `playback_end_tick` is the end of the win panel. When it is 0, keep three
 * seconds after the win. The last tick is at most one before the next round.
 * On the last round that bound is the last recorded sample, not
 * `header.playback_ticks` (0 or past the buffer on a truncated demo).
 */
export function clipCoverLastTick(
  round: ClipRoundClock,
  rate: number,
  nextStartTick: number | null,
  sampleEndTick: number,
  tailSeconds = CLIP_POST_ROUND_TAIL_SECONDS,
): number {
  const win = round.end_tick;
  const playbackEnd = round.playback_end_tick ?? 0;
  const tail = rate > 0 ? win + tailSeconds * rate : win;
  let last = playbackEnd > 0 ? playbackEnd : tail;
  if (nextStartTick != null && nextStartTick > 0) {
    last = Math.min(last, nextStartTick - 1);
  } else if (sampleEndTick > 0) {
    last = Math.min(last, sampleEndTick);
    if (sampleEndTick < win) return sampleEndTick;
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
  sampleEndTick: number,
): ClipSpan {
  const live = clipRoundBounds(round);
  const last = clipCoverLastTick(round, rate, nextStartTick, sampleEndTick);
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
 * Plant through the same exclusive end as full round ({@link clipRoundCover}).
 * Pass the cover, not the live `end_tick` window, so explosion and defuse
 * rounds still include the win panel when there is no final kill.
 * No plant, or a plant on the cover's last tick, returns null.
 */
export function postPlantSpan(cover: ClipSpan, plantTick: number | null): ClipSpan | null {
  if (plantTick == null) return null;
  const span = clampClipSpan({ startTick: plantTick, endTick: cover.endTick }, cover);
  if (!(span.endTick > span.startTick)) return null;
  return span;
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

export function clipExportBitrate(size: number): number {
  return size >= CLIP_EXPORT_SIZE_HIGH ? CLIP_EXPORT_BITRATE_1440 : CLIP_EXPORT_BITRATE_1080;
}

/** Real-time fallback names the wall-clock length. Offline encode does not. */
export function clipExportHint(path: ClipEncodePath, size: number, seconds = 0): string {
  if (path === "media-recorder") {
    return `This browser records in real time, so this export takes ${formatClipDuration(seconds)}. Offline export needs H.264 in WebCodecs.`;
  }
  return `${clipExportFrameLabel(size)} · ${CLIP_EXPORT_FPS} fps · encoded on this device`;
}

/** Frame count is duration × fps. Timestamps partition the demo span. */
export function clipFrameSchedule(span: ClipSpan, rate: number, fps: number): ClipFrameClock {
  return clipFrameClock(span, rate, fps);
}

/** Neither encode path refuses a long round. `path` records which encoder was chosen. */
export function clipSpanIssue(
  span: ClipSpan,
  rate: number,
  path: ClipEncodePath | null,
): ReturnType<typeof clipRangeIssue> {
  void path;
  return clipRangeIssue(span, rate, null);
}
