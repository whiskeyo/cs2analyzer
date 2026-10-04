import {
  BufferTarget,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import {
  CLIP_ENCODE_QUEUE_FRAMES,
  CLIP_EXPORT_FAILED,
  CLIP_EXPORT_KEYFRAME_SECONDS,
  CLIP_TIMESTAMP_US,
} from "@/lib/export/constants";

export interface ClipEncodeSessionConfig {
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  onError: (message: string) => void;
}

export interface ClipEncodeSession {
  encode(
    bitmap: ImageBitmap,
    timestamp: number,
    duration: number,
    index: number,
    onQueued: () => void,
  ): void;
  finish(): Promise<ArrayBuffer>;
  close(): void;
}

/**
 * H.264 `VideoEncoder` plus an in-memory MP4 mux. Frames carry explicit
 * timestamps, so the file's clock is demo time rather than the wall clock.
 * Imported only from the export worker (and the main-thread fallback).
 */
export function openClipEncodeSession(config: ClipEncodeSessionConfig): ClipEncodeSession {
  if (typeof VideoEncoder === "undefined") {
    throw new Error(CLIP_EXPORT_FAILED);
  }
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const video = new EncodedVideoPacketSource("avc");
  output.addVideoTrack(video, { frameRate: config.fps });
  let failed = false;
  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    config.onError(error instanceof Error && error.message ? error.message : CLIP_EXPORT_FAILED);
  };
  // Encoder output can fire before `start` resolves. Keep packets in decode order.
  let writes = Promise.resolve();
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (failed) return;
      let packet: EncodedPacket;
      try {
        packet = EncodedPacket.fromEncodedChunk(chunk);
      } catch (error) {
        fail(error);
        return;
      }
      writes = writes
        .then(async () => {
          if (failed) return;
          await video.add(packet, meta);
        })
        .catch((error: unknown) => {
          fail(error);
        });
    },
    error: (error) => {
      fail(error);
    },
  });
  encoder.configure({
    codec: config.codec,
    width: config.width,
    height: config.height,
    bitrate: config.bitrate,
    framerate: config.fps,
    latencyMode: "quality",
    avc: { format: "avc" },
  });
  writes = output.start().catch((error: unknown) => {
    fail(error);
  });
  const keyEvery = Math.max(1, Math.round(config.fps * CLIP_EXPORT_KEYFRAME_SECONDS));
  const fallbackDuration = Math.round(CLIP_TIMESTAMP_US / config.fps);
  let closed = false;

  const closeEncoder = () => {
    if (closed) return;
    closed = true;
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      // Already closed by a previous cancel or error.
    }
  };

  return {
    encode(bitmap, timestamp, duration, index, onQueued) {
      if (closed || failed) {
        bitmap.close();
        return;
      }
      const frame = new VideoFrame(bitmap, {
        timestamp,
        duration: duration > 0 ? duration : fallbackDuration,
      });
      bitmap.close();
      try {
        encoder.encode(frame, { keyFrame: index % keyEvery === 0 });
      } finally {
        frame.close();
      }
      const notify = () => {
        if (closed || failed || encoder.state === "closed") return;
        if (encoder.encodeQueueSize <= CLIP_ENCODE_QUEUE_FRAMES) {
          onQueued();
          return;
        }
        encoder.addEventListener("dequeue", notify, { once: true });
      };
      notify();
    },
    async finish() {
      if (failed) throw new Error(CLIP_EXPORT_FAILED);
      await encoder.flush();
      await writes;
      if (failed || closed) throw new Error(CLIP_EXPORT_FAILED);
      video.close();
      await output.finalize();
      const buffer = target.buffer;
      if (!buffer) throw new Error(CLIP_EXPORT_FAILED);
      closeEncoder();
      return buffer;
    },
    close() {
      failed = true;
      closeEncoder();
    },
  };
}
