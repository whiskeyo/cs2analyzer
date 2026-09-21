import {
  CLIP_EXPORT_DEFAULT_SECONDS,
  CLIP_EXPORT_EMPTY,
  CLIP_EXPORT_FAILED,
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_MAX_SECONDS,
  CLIP_EXPORT_NO_CANVAS,
  CLIP_EXPORT_TOO_SHORT,
  CLIP_EXPORT_VIDEO_BITS_PER_SECOND,
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

export function clipRangeIssue(
  span: ClipSpan,
  rate: number,
  maxSeconds = CLIP_EXPORT_MAX_SECONDS,
): ClipRangeIssue | null {
  if (!(span.endTick > span.startTick) || !(rate > 0)) return "empty";
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

/**
 * One sample tick per video frame. Ticks advance by `rate / fps` so a 15s
 * range is exactly 15 × 60 frames and stays strictly inside `[start, end)`.
 */
export function clipFrameTicks(span: ClipSpan, rate: number, fps = CLIP_EXPORT_FPS): number[] {
  if (!(rate > 0) || !(fps > 0) || !(span.endTick > span.startTick)) return [];
  const seconds = (span.endTick - span.startTick) / rate;
  const count = Math.round(seconds * fps);
  if (count <= 0) return [];
  const ticks: number[] = [];
  const step = rate / fps;
  for (let i = 0; i < count; i++) {
    ticks.push(span.startTick + i * step);
  }
  return ticks;
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

/** Round clock with a tenth, same origin the caller picks (usually freeze end). */
export function formatClipClock(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(seconds);
  const minutes = Math.floor(abs / 60);
  const rest = (abs - minutes * 60).toFixed(1).padStart(4, "0");
  return `${sign}${minutes}:${rest}`;
}

export function formatClipDuration(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
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
  paintAt: (tick: number) => void;
  fps?: number;
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
 * Record `ticks` in order at `fps`. MediaRecorder stamps frames from the wall
 * clock, so each frame is held for `1/fps` seconds. `captureStream(0)` plus
 * `requestFrame` pushes exactly one bitmap per tick when the browser allows it.
 */
export async function recordRadarClip(options: RecordRadarClipOptions): Promise<Blob> {
  const {
    canvas,
    ticks,
    mimeType,
    paintAt,
    onFrame,
    signal,
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
  try {
    const first = ticks[0];
    if (first === undefined) throw new Error(CLIP_EXPORT_TOO_SHORT);
    paintAt(first);
    recorder.start();
    started = true;
    let nextAt = now();
    for (const [index, tick] of ticks.entries()) {
      if (signal?.aborted) {
        throw new DOMException("Clip export cancelled", "AbortError");
      }
      paintAt(tick);
      if (manualFrames) requestCanvasFrame(recorded);
      onFrame?.(index, tick);
      nextAt += frameMs;
      const wait = nextAt - now();
      if (wait > 0) await sleep(wait);
      else nextAt = now();
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
    stopStream(recorded);
  }
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
