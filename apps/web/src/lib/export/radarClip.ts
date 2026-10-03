import {
  CLIP_EXPORT_DEFAULT_SECONDS,
  CLIP_EXPORT_EMPTY,
  CLIP_EXPORT_FAILED,
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_MAX_SECONDS,
  CLIP_EXPORT_NO_CANVAS,
  CLIP_EXPORT_TAB_HIDDEN,
  CLIP_EXPORT_TOO_SHORT,
  CLIP_EXPORT_VIDEO_BITS_PER_SECOND,
  CLIP_TIMESTAMP_US,
} from "@/lib/export/constants";

/** Inclusive-exclusive demo tick window. `endTick` is the first tick not shown. */
export interface ClipSpan {
  startTick: number;
  endTick: number;
}

export type ClipRangeIssue = "empty" | "too-long";

/** Video mime types, preferred first. Audio codecs are omitted; the clip is silent. */
export const CLIP_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export interface RadarClipRecorder {
  mimeType: string;
  state: string;
  start: () => void;
  stop: () => void;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

export function clipDurationSeconds(span: ClipSpan, rate: number): number {
  if (!(rate > 0)) return 0;
  return Math.max(0, (span.endTick - span.startTick) / rate);
}

/**
 * `maxSeconds === null` allows the whole span. Export uses that for both
 * encode paths. Helpers that still window a clip pass {@link CLIP_EXPORT_MAX_SECONDS}.
 */
export function clipRangeIssue(
  span: ClipSpan,
  rate: number,
  maxSeconds: number | null = CLIP_EXPORT_MAX_SECONDS,
): ClipRangeIssue | null {
  if (!(span.endTick > span.startTick) || !(rate > 0)) return "empty";
  if (maxSeconds == null) return null;
  const maxTicks = maxSeconds * rate;
  if (span.endTick - span.startTick > maxTicks + 0.001) return "too-long";
  return null;
}

function clampTick(tick: number, bounds: ClipSpan): number {
  return Math.min(bounds.endTick, Math.max(bounds.startTick, tick));
}

/**
 * Continuous window ending at `tick`, clipped to `bounds` and to the max length.
 * A playhead near the start yields a shorter clip rather than crossing the bound.
 */
export function lastSecondsSpan(
  tick: number,
  seconds: number,
  bounds: ClipSpan,
  rate: number,
  maxSeconds = CLIP_EXPORT_MAX_SECONDS,
): ClipSpan {
  const windowSec = Math.min(Math.max(seconds, 0), maxSeconds);
  const endTick = clampTick(tick, bounds);
  const startTick =
    rate > 0 ? Math.max(bounds.startTick, endTick - windowSec * rate) : bounds.startTick;
  return { startTick, endTick };
}

/**
 * Opening a clip: the previous 15s when that history exists, otherwise the
 * next 15s from the playhead (the start of a round has nothing behind it).
 */
export function defaultClipSpan(
  tick: number,
  bounds: ClipSpan,
  rate: number,
  seconds = CLIP_EXPORT_DEFAULT_SECONDS,
): ClipSpan {
  const last = lastSecondsSpan(tick, seconds, bounds, rate);
  if (clipDurationSeconds(last, rate) >= 1) return last;
  const startTick = clampTick(tick, bounds);
  const endTick = rate > 0 ? Math.min(bounds.endTick, startTick + seconds * rate) : startTick;
  return { startTick, endTick };
}

/**
 * Current round scrub window. Short rounds export whole. Longer rounds export
 * up to `maxSeconds` and keep the playhead inside the window.
 */
export function roundWindowSpan(
  tick: number,
  bounds: ClipSpan,
  rate: number,
  maxSeconds = CLIP_EXPORT_MAX_SECONDS,
): ClipSpan {
  if (!(rate > 0) || !(bounds.endTick > bounds.startTick)) {
    return { startTick: bounds.startTick, endTick: bounds.endTick };
  }
  const maxTicks = maxSeconds * rate;
  if (bounds.endTick - bounds.startTick <= maxTicks + 0.001) {
    return { startTick: bounds.startTick, endTick: bounds.endTick };
  }
  const playhead = clampTick(tick, bounds);
  const startTick = Math.max(bounds.startTick, playhead - maxTicks);
  const endTick = Math.min(bounds.endTick, startTick + maxTicks);
  return { startTick, endTick };
}

/** Demo length of a clip, in microseconds. This is the file's duration. */
export function clipSpanDurationUs(span: ClipSpan, rate: number): number {
  if (!(rate > 0) || !(span.endTick > span.startTick)) return 0;
  return Math.round(((span.endTick - span.startTick) * CLIP_TIMESTAMP_US) / rate);
}

export interface ClipFrameClock {
  ticks: number[];
  /** Presentation time of each frame, microseconds from the first frame. */
  timestamps: number[];
  /** How long each frame is shown. The sum is {@link clipSpanDurationUs}. */
  durations: number[];
}

/**
 * One sample tick per video frame, spaced across the span.
 * Frame timestamps partition the demo duration, so the file lasts
 * `(endTick - startTick) / rate`. Export is {@link CLIP_EXPORT_FPS}.
 * Fractional ticks fall between `tick_stride` samples; `samplePlayer` blends
 * those the same way live playback does, and snaps across a death or teleport.
 */
export function clipFrameClock(span: ClipSpan, rate: number, fps: number): ClipFrameClock {
  const durationUs = clipSpanDurationUs(span, rate);
  const seconds = durationUs / CLIP_TIMESTAMP_US;
  const count = fps > 0 ? Math.round(seconds * fps) : 0;
  if (!(rate > 0) || count <= 0 || durationUs <= 0) {
    return { ticks: [], timestamps: [], durations: [] };
  }
  const ticks: number[] = [];
  const timestamps: number[] = [];
  const durations: number[] = [];
  const spanTicks = span.endTick - span.startTick;
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    ticks.push(span.startTick + (i * spanTicks) / count);
    const next = i + 1 === count ? durationUs : Math.round(((i + 1) * durationUs) / count);
    timestamps.push(cursor);
    durations.push(next - cursor);
    cursor = next;
  }
  return { ticks, timestamps, durations };
}

/** One sample tick per video frame. Stays strictly inside `[start, end)`. */
export function clipFrameTicks(span: ClipSpan, rate: number, fps = CLIP_EXPORT_FPS): number[] {
  return clipFrameClock(span, rate, fps).ticks;
}

/** Presentation timestamp in microseconds for frame `index`. */
export function clipFrameTimestamp(index: number, fps: number): number {
  if (!(fps > 0) || index <= 0) return 0;
  return Math.round((index * CLIP_TIMESTAMP_US) / fps);
}

/**
 * One timestamp per frame. Rounding can theoretically collide at odd frame
 * rates, so each step is forced strictly above the previous one.
 */
export function clipFrameTimestamps(frameCount: number, fps: number): number[] {
  if (!(fps > 0) || frameCount <= 0) return [];
  const stamps: number[] = [];
  let previous = -1;
  for (let i = 0; i < frameCount; i++) {
    let stamp = clipFrameTimestamp(i, fps);
    if (stamp <= previous) stamp = previous + 1;
    stamps.push(stamp);
    previous = stamp;
  }
  return stamps;
}

export function preferredClipMime(isTypeSupported: (mime: string) => boolean): string | null {
  for (const mime of CLIP_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      // A broken isTypeSupported should not hide a later candidate.
    }
  }
  return null;
}

export function mediaRecorderSupports(mime: string): boolean {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return false;
  }
  try {
    return MediaRecorder.isTypeSupported(mime);
  } catch {
    return false;
  }
}

export function clipExtension(mime: string): "mp4" | "webm" {
  return mime.includes("mp4") ? "mp4" : "webm";
}

export function clipMapSlug(mapName: string): string {
  const base = mapName.split("/").pop() ?? mapName;
  const slug = base.replace(/[^\w.-]+/g, "").replace(/_scrimmagemap$/, "");
  return slug || "radar";
}

export function clipDownloadName(mapName: string, roundSlug: string | null, mime: string): string {
  const ext = clipExtension(mime);
  const map = clipMapSlug(mapName);
  const round = roundSlug ? `-${roundSlug}` : "";
  return `${map}${round}.${ext}`;
}

export function clipRoundSlug(round: { number: number; is_knife: boolean } | null): string | null {
  if (!round) return null;
  if (round.is_knife) return "knife";
  return `r${round.number}`;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

function requestCanvasFrame(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  if (!track || typeof track.requestFrame !== "function") return false;
  track.requestFrame();
  return true;
}

function defaultRecorder(
  stream: MediaStream,
  mimeType: string,
  videoBitsPerSecond: number,
): RadarClipRecorder {
  // MediaRecorder's event handler types are stricter than the slice this exporter uses.
  return new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond,
  }) as unknown as RadarClipRecorder;
}

export interface RecordRadarClipOptions {
  canvas: HTMLCanvasElement;
  ticks: readonly number[];
  mimeType: string;
  paintAt: (tick: number) => void | Promise<void>;
  fps?: number;
  /** Per-frame hold, milliseconds. When set, the sum is the demo span. */
  holdMs?: readonly number[];
  videoBitsPerSecond?: number;
  onFrame?: (index: number, tick: number) => void;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  createRecorder?: (
    stream: MediaStream,
    mimeType: string,
    videoBitsPerSecond: number,
  ) => RadarClipRecorder;
}

/**
 * Record `ticks` in order. MediaRecorder stamps frames from the wall clock.
 * `holdMs` keeps each frame for its share of the demo span; otherwise each
 * frame is held for `1/fps` seconds. `captureStream(0)` plus `requestFrame`
 * pushes exactly one bitmap per tick when the browser allows it.
 */
export async function recordRadarClip(options: RecordRadarClipOptions): Promise<Blob> {
  const {
    canvas,
    ticks,
    mimeType,
    paintAt,
    onFrame,
    signal,
    holdMs,
    fps = CLIP_EXPORT_FPS,
    videoBitsPerSecond = CLIP_EXPORT_VIDEO_BITS_PER_SECOND,
    now = () => performance.now(),
    sleep = sleepMs,
    createRecorder = defaultRecorder,
  } = options;

  if (ticks.length === 0) {
    throw new Error(CLIP_EXPORT_TOO_SHORT);
  }
  if (typeof canvas.captureStream !== "function") {
    throw new Error(CLIP_EXPORT_NO_CANVAS);
  }
  if (signal?.aborted) {
    throw new DOMException("Clip export cancelled", "AbortError");
  }
  if (tabIsHidden()) {
    throw new Error(CLIP_EXPORT_TAB_HIDDEN);
  }

  const stream = canvas.captureStream(0);
  const manualFrames =
    typeof (stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined)
      ?.requestFrame === "function";
  const recorded = manualFrames ? stream : replaceWithAutoStream(stream, canvas, fps);
  const recorder = createRecorder(recorded, mimeType, videoBitsPerSecond);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let rejectStopped: (error: Error) => void = () => {};
  let resolveStopped: () => void = () => {};
  const stopped = new Promise<void>((resolve, reject) => {
    resolveStopped = resolve;
    rejectStopped = reject;
  });
  recorder.onstop = () => resolveStopped();
  recorder.onerror = () => rejectStopped(new Error(CLIP_EXPORT_FAILED));

  const frameMs = 1000 / fps;
  let started = false;
  let rejectHidden: (error: Error) => void = () => {};
  const hidden = new Promise<never>((_resolve, reject) => {
    rejectHidden = reject;
  });
  hidden.catch(() => undefined);
  const stopWatch = watchTabHidden(() => {
    rejectHidden(new Error(CLIP_EXPORT_TAB_HIDDEN));
  });
  try {
    const first = ticks[0];
    if (first === undefined) throw new Error(CLIP_EXPORT_TOO_SHORT);
    await paintAt(first);
    recorder.start();
    started = true;
    let nextAt = now();
    for (const [index, tick] of ticks.entries()) {
      if (signal?.aborted) {
        throw new DOMException("Clip export cancelled", "AbortError");
      }
      if (tabIsHidden()) throw new Error(CLIP_EXPORT_TAB_HIDDEN);
      await paintAt(tick);
      if (manualFrames) requestCanvasFrame(recorded);
      onFrame?.(index, tick);
      nextAt += holdMs?.[index] ?? frameMs;
      const wait = nextAt - now();
      if (wait > 0) await Promise.race([sleep(wait), hidden]);
      else nextAt = now();
      if (tabIsHidden()) throw new Error(CLIP_EXPORT_TAB_HIDDEN);
    }
    if (signal?.aborted) {
      throw new DOMException("Clip export cancelled", "AbortError");
    }
    if (recorder.state === "recording") recorder.stop();
    await stopped;
    if (chunks.length === 0) throw new Error(CLIP_EXPORT_EMPTY);
    return new Blob(chunks, { type: recorder.mimeType || mimeType });
  } catch (error) {
    if (started && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        resolveStopped();
      }
      await stopped.catch(() => undefined);
    }
    throw error;
  } finally {
    stopWatch();
    stopStream(recorded);
  }
}

function tabIsHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** Background tabs throttle timers, so a hidden page must not finish the file. */
function watchTabHidden(onHidden: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const onChange = () => {
    if (document.visibilityState === "hidden") onHidden();
  };
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Browsers without manual frames capture on a timer instead. */
function replaceWithAutoStream(
  manual: MediaStream,
  canvas: HTMLCanvasElement,
  fps: number,
): MediaStream {
  stopStream(manual);
  return canvas.captureStream(fps);
}
