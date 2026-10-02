import {
  CLIP_EXPORT_FAILED,
  CLIP_EXPORT_NOT_READY,
  CLIP_EXPORT_NO_CANVAS,
  clipExportFrame,
} from "@/lib/export/constants";
import type { ClipEncoderChoice } from "@/lib/export/clipEncodeSupport";
import { clipFrameSchedule } from "@/lib/export/clipPlan";
import { clipDownloadName, recordRadarClip, type ClipSpan } from "@/lib/export/radarClip";
import { radarClipSurface, setRadarClipHold } from "@/lib/radar/radarClipSurface";
import { HUD_TICK_INTERVAL_MS } from "@/lib/shared/constants";
import { downloadBlob } from "@/lib/shared/download";

export interface RunClipExportInput {
  choice: ClipEncoderChoice;
  span: ClipSpan;
  rate: number;
  fps: number;
  size: number;
  mapName: string;
  roundSlug: string | null;
  restoreTick: number;
  onTick: (tick: number) => void;
  onProgress: (ratio: number) => void;
  onPlaying: (playing: boolean) => void;
  signal: AbortSignal;
}

/** 16:9 bitmap the real-time recorder captures. The on-screen radar stays put. */
function clipRecordCanvas(size: number): HTMLCanvasElement {
  if (typeof document === "undefined") throw new Error(CLIP_EXPORT_NO_CANVAS);
  const frame = clipExportFrame(size);
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  return canvas;
}

/** Paint and encode the span. Resolves after the file is saved, or rejects. */
export async function runClipExport(input: RunClipExportInput): Promise<void> {
  const surface = radarClipSurface();
  if (!surface) return Promise.reject(new Error(CLIP_EXPORT_NOT_READY));
  const scheduled = clipFrameSchedule(input.span, input.rate, input.fps);
  if (scheduled.ticks.length === 0) {
    return Promise.reject(new Error("Pick a start before the end."));
  }

  input.onPlaying(false);
  setRadarClipHold(true);
  if (surface.prepareClipHud) {
    try {
      await surface.prepareClipHud(input.size, input.span.startTick);
    } catch {
      // The painted HUD still exports.
    }
  }
  let lastUi = 0;
  const publish = (index: number, frameTick: number, ratio: number) => {
    const now = performance.now();
    const last = index === scheduled.ticks.length - 1;
    if (last || now - lastUi >= HUD_TICK_INTERVAL_MS) {
      lastUi = now;
      input.onTick(Math.round(frameTick));
      input.onProgress(ratio);
    }
  };
  const finish = (blob: Blob, mime: string) => {
    const type = blob.type || mime;
    downloadBlob(clipDownloadName(input.mapName, input.roundSlug, type), type, blob);
    input.onTick(Math.round(input.span.endTick));
  };
  const fail = (err: unknown) => {
    input.onTick(input.restoreTick);
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw err instanceof Error ? err : new Error(CLIP_EXPORT_FAILED);
  };

  const recorded = input.choice.path === "media-recorder" ? clipRecordCanvas(input.size) : null;
  const work =
    input.choice.path === "media-recorder"
      ? recordRadarClip({
          canvas: recorded ?? surface.canvas,
          ticks: scheduled.ticks,
          holdMs: scheduled.durations.map((us) => us / 1000),
          mimeType: input.choice.mime,
          paintAt: (frameTick) => {
            if (recorded) return surface.paintFrame(recorded, input.size, frameTick);
          },
          fps: input.fps,
          signal: input.signal,
          onFrame: (index, frameTick) =>
            publish(index, frameTick, (index + 1) / scheduled.ticks.length),
        }).then((blob) => {
          if (input.choice.path === "media-recorder") finish(blob, input.choice.mime);
        })
      : import("@/lib/export/radarClipEncode").then(({ encodeRadarClip }) => {
          if (input.signal.aborted) {
            throw new DOMException("Clip export cancelled", "AbortError");
          }
          if (input.choice.path !== "webcodecs") return;
          return encodeRadarClip({
            size: input.size,
            fps: input.fps,
            ticks: scheduled.ticks,
            timestamps: scheduled.timestamps,
            durations: scheduled.durations,
            codec: input.choice.codec,
            bitrate: input.choice.bitrate,
            signal: input.signal,
            paintFrame: (canvas, frameTick) => surface.paintFrame(canvas, input.size, frameTick),
            onProgress: (ratio) => {
              const index = Math.min(
                scheduled.ticks.length - 1,
                Math.floor(ratio * scheduled.ticks.length),
              );
              publish(index, scheduled.ticks[index] ?? input.span.startTick, ratio);
            },
          }).then((blob) => finish(blob, "video/mp4"));
        });

  return work.catch(fail).finally(() => {
    setRadarClipHold(false);
    try {
      surface.releaseClipHud?.();
    } catch {
      // Dropping the offscreen HUD must not hide an export error.
    }
  });
}
