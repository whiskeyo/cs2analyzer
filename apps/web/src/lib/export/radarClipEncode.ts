import {
  CLIP_ENCODE_QUEUE_FRAMES,
  CLIP_EXPORT_FAILED,
  CLIP_EXPORT_NO_CANVAS,
  CLIP_EXPORT_TOO_SHORT,
  CLIP_TIMESTAMP_US,
  clipExportFrame,
} from "@/lib/export/constants";
import { clipFrameTimestamp } from "@/lib/export/radarClip";
import type { ClipEncodeOut, ClipEncodeWorker } from "@/lib/export/radarClipEncodeProtocol";
import { createRadarClipEncodeWorker } from "@/lib/export/radarClipEncodeWorkerFactory";

/**
 * The radar painter draws HTML images and a DOM text editor, so frames are
 * rasterized on the main thread into an OffscreenCanvas. Encoding and muxing
 * run in a worker with explicit timestamps. If that worker cannot start
 * `VideoEncoder`, the same session runs on this thread — still offline.
 */

export interface ClipFrameCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  transferToImageBitmap?: () => ImageBitmap;
}

export interface EncodeRadarClipOptions {
  size: number;
  fps: number;
  ticks: readonly number[];
  /** Microseconds. When set, the file lasts as long as the demo span. */
  timestamps?: readonly number[];
  durations?: readonly number[];
  codec: string;
  bitrate: number;
  paintFrame: (canvas: ClipFrameCanvas, tick: number) => void | Promise<void>;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
  createWorker?: () => ClipEncodeWorker;
  createCanvas?: (width: number, height: number) => ClipFrameCanvas;
  takeBitmap?: (canvas: ClipFrameCanvas) => ImageBitmap | Promise<ImageBitmap>;
}

function abortError(): DOMException {
  return new DOMException("Clip export cancelled", "AbortError");
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function createFrameCanvas(width: number, height: number): ClipFrameCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error(CLIP_EXPORT_NO_CANVAS);
}

async function takeBitmap(canvas: ClipFrameCanvas): Promise<ImageBitmap> {
  if (typeof canvas.transferToImageBitmap === "function") {
    return canvas.transferToImageBitmap();
  }
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(canvas as ImageBitmapSource);
  }
  throw new Error(CLIP_EXPORT_NO_CANVAS);
}

interface EncodeLoopState {
  sent: number;
  encoded: number;
  failure: Error | null;
  waiters: Array<() => void>;
}

function wake(state: EncodeLoopState): void {
  const pending = state.waiters.splice(0);
  for (const resolve of pending) resolve();
}

async function waitForRoom(state: EncodeLoopState, signal: AbortSignal | undefined): Promise<void> {
  while (state.sent - state.encoded - 1 >= CLIP_ENCODE_QUEUE_FRAMES) {
    if (signal?.aborted) throw abortError();
    if (state.failure) throw state.failure;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        signal?.removeEventListener("abort", onAbort);
        const index = state.waiters.indexOf(onRoom);
        if (index >= 0) state.waiters.splice(index, 1);
        if (error) reject(error);
        else resolve();
      };
      const onRoom = () => finish();
      const onAbort = () => finish(abortError());
      state.waiters.push(onRoom);
      if (signal?.aborted) {
        finish(abortError());
        return;
      }
      signal?.addEventListener("abort", onAbort);
    });
  }
}

async function paintFrames(
  options: EncodeRadarClipOptions,
  canvas: ClipFrameCanvas,
  send: (bitmap: ImageBitmap, timestamp: number, duration: number, index: number) => void,
  state: EncodeLoopState,
): Promise<void> {
  const { ticks, fps, paintFrame, signal, takeBitmap: grab = takeBitmap } = options;
  let lastYield = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  for (let index = 0; index < ticks.length; index++) {
    if (signal?.aborted) throw abortError();
    if (state.failure) throw state.failure;
    await waitForRoom(state, signal);
    const tick = ticks[index];
    if (tick === undefined) throw new Error(CLIP_EXPORT_TOO_SHORT);
    // The page HUD raster is async. The bitmap must match this tick, including a kill
    // that just changed the scoreboard, before the encoder takes the frame.
    await paintFrame(canvas, tick);
    if (signal?.aborted) throw abortError();
    const bitmap = await grab(canvas);
    if (signal?.aborted) {
      bitmap.close();
      throw abortError();
    }
    const timestamp = options.timestamps?.[index] ?? clipFrameTimestamp(index, fps);
    const duration = options.durations?.[index] ?? Math.round(CLIP_TIMESTAMP_US / fps);
    send(bitmap, timestamp, duration, index);
    state.sent += 1;
    const clock = now();
    if (clock - lastYield > 50) {
      lastYield = clock;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }
}

function bindWorker(
  worker: ClipEncodeWorker,
  state: EncodeLoopState,
  options: EncodeRadarClipOptions,
): { ready: Promise<void>; done: Promise<ArrayBuffer> } {
  const { signal } = options;
  let readyResolve: () => void = () => {};
  let readyReject: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  let doneResolve: (buffer: ArrayBuffer) => void = () => {};
  let doneReject: (error: Error) => void = () => {};
  const done = new Promise<ArrayBuffer>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });
  // Abort rejects this promise while the painter may already have thrown.
  void ready.catch(() => undefined);
  void done.catch(() => undefined);
  const fail = (error: Error) => {
    if (!state.failure) state.failure = error;
    wake(state);
    readyReject(error);
    doneReject(error);
  };
  if (signal) {
    signal.addEventListener(
      "abort",
      () => {
        try {
          worker.postMessage({ type: "cancel" });
        } catch {
          // The worker may already be gone.
        }
        worker.terminate();
        fail(abortError());
      },
      { once: true },
    );
  }
  worker.onerror = () => fail(new Error(CLIP_EXPORT_FAILED));
  worker.onmessage = (event: MessageEvent<ClipEncodeOut>) => {
    const message = event.data;
    if (message.type === "ready") {
      readyResolve();
      return;
    }
    if (message.type === "encoded") {
      state.encoded = Math.max(state.encoded, message.index);
      options.onProgress?.((state.encoded + 1) / options.ticks.length);
      wake(state);
      return;
    }
    if (message.type === "done") {
      if (signal?.aborted) return;
      doneResolve(message.buffer);
      return;
    }
    fail(new Error(message.message || CLIP_EXPORT_FAILED));
  };
  return { ready, done };
}

async function encodeWithWorker(
  worker: ClipEncodeWorker,
  options: EncodeRadarClipOptions,
  canvas: ClipFrameCanvas,
  sent: { n: number },
): Promise<ArrayBuffer> {
  const state: EncodeLoopState = {
    sent: 0,
    encoded: -1,
    failure: null,
    waiters: [],
  };
  const { ready, done } = bindWorker(worker, state, options);
  worker.postMessage({
    type: "start",
    width: canvas.width,
    height: canvas.height,
    fps: options.fps,
    codec: options.codec,
    bitrate: options.bitrate,
  });
  await ready;
  try {
    await paintFrames(
      options,
      canvas,
      (bitmap, timestamp, duration, index) => {
        worker.postMessage({ type: "frame", bitmap, timestamp, duration, index }, [bitmap]);
      },
      state,
    );
  } finally {
    sent.n = state.sent;
  }
  if (options.signal?.aborted) throw abortError();
  worker.postMessage({ type: "finish" });
  const buffer = await done;
  if (options.signal?.aborted) throw abortError();
  return buffer;
}

async function encodeOnMainThread(
  options: EncodeRadarClipOptions,
  canvas: ClipFrameCanvas,
): Promise<ArrayBuffer> {
  const { openClipEncodeSession } = await import("./radarClipEncodeSession");
  const state: EncodeLoopState = {
    sent: 0,
    encoded: -1,
    failure: null,
    waiters: [],
  };
  let session: ReturnType<typeof openClipEncodeSession> | null = null;
  const fail = (message: string) => {
    state.failure = new Error(message);
    wake(state);
  };
  session = openClipEncodeSession({
    width: canvas.width,
    height: canvas.height,
    fps: options.fps,
    codec: options.codec,
    bitrate: options.bitrate,
    onError: fail,
  });
  const stop = () => {
    session?.close();
    session = null;
  };
  if (options.signal?.aborted) {
    stop();
    throw abortError();
  }
  options.signal?.addEventListener("abort", stop, { once: true });
  try {
    await paintFrames(
      options,
      canvas,
      (bitmap, timestamp, duration, index) => {
        session?.encode(bitmap, timestamp, duration, index, () => {
          state.encoded = Math.max(state.encoded, index);
          options.onProgress?.((state.encoded + 1) / options.ticks.length);
          wake(state);
        });
      },
      state,
    );
    if (options.signal?.aborted) throw abortError();
    if (state.failure) throw state.failure;
    const buffer = await session.finish();
    if (options.signal?.aborted) throw abortError();
    return buffer;
  } finally {
    stop();
  }
}

/** Encode `ticks` as fast as the CPU allows. Cancel rejects and leaves no file. */
export async function encodeRadarClip(options: EncodeRadarClipOptions): Promise<Blob> {
  const {
    ticks,
    signal,
    createWorker = createRadarClipEncodeWorker,
    createCanvas = createFrameCanvas,
  } = options;
  if (ticks.length === 0) throw new Error(CLIP_EXPORT_TOO_SHORT);
  if (signal?.aborted) throw abortError();
  const frame = clipExportFrame(options.size);
  const canvas = createCanvas(frame.width, frame.height);
  if (canvas.width !== frame.width || canvas.height !== frame.height) {
    canvas.width = frame.width;
    canvas.height = frame.height;
  }
  const injected = options.createWorker != null;
  const worker = createWorker();
  const sent = { n: 0 };
  try {
    const buffer = await encodeWithWorker(worker, options, canvas, sent);
    options.onProgress?.(1);
    return new Blob([buffer], { type: "video/mp4" });
  } catch (error) {
    worker.terminate();
    if (isAbort(error) || injected || sent.n > 0) throw error;
    const buffer = await encodeOnMainThread(options, canvas);
    options.onProgress?.(1);
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    worker.terminate();
  }
}
