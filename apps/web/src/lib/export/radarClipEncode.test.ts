import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLIP_EXPORT_TOO_SHORT } from "@/lib/export/constants";
import { clipFrameTimestamp } from "@/lib/export/radarClip";
import { encodeRadarClip, type ClipFrameCanvas } from "@/lib/export/radarClipEncode";
import type {
  ClipEncodeIn,
  ClipEncodeOut,
  ClipEncodeWorker,
} from "@/lib/export/radarClipEncodeProtocol";

class FakeWorker implements ClipEncodeWorker {
  onmessage: ((event: MessageEvent<ClipEncodeOut>) => void) | null = null;
  onerror: AbstractWorker["onerror"] = null;
  terminated = false;
  cancelled = false;
  frames: { timestamp: number; index: number }[] = [];
  failOnStart = false;

  postMessage(message: ClipEncodeIn) {
    if (message.type === "cancel") {
      this.cancelled = true;
      return;
    }
    if (message.type === "start") {
      queueMicrotask(() => {
        if (this.failOnStart) this.emit({ type: "error", message: "no encoder" });
        else this.emit({ type: "ready" });
      });
      return;
    }
    if (message.type === "frame") {
      message.bitmap.close();
      this.frames.push({ timestamp: message.timestamp, index: message.index });
      queueMicrotask(() => this.emit({ type: "encoded", index: message.index }));
      return;
    }
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    queueMicrotask(() => this.emit({ type: "done", buffer }));
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: ClipEncodeOut) {
    this.onmessage?.({ data } as MessageEvent<ClipEncodeOut>);
  }
}

function canvas(): ClipFrameCanvas {
  return { width: 1080, height: 1080, getContext: () => null };
}

describe("encodeRadarClip", () => {
  it("sends monotonic timestamps and does not depend on the window", async () => {
    const worker = new FakeWorker();
    const painted: number[] = [];
    const progress: number[] = [];
    const ticks = [10, 11.5, 13];
    const blob = await encodeRadarClip({
      size: 1080,
      fps: 30,
      ticks,
      codec: "avc1.640028",
      bitrate: 12_000_000,
      paintFrame: (_canvas, tick) => painted.push(tick),
      onProgress: (ratio) => progress.push(ratio),
      createWorker: () => worker,
      createCanvas: () => canvas(),
      takeBitmap: () => ({ close: vi.fn() }) as unknown as ImageBitmap,
    });

    expect(painted).toEqual(ticks);
    expect(worker.frames.map((frame) => frame.timestamp)).toEqual(
      ticks.map((_, i) => clipFrameTimestamp(i, 30)),
    );
    expect(worker.frames.map((frame) => frame.index)).toEqual([0, 1, 2]);
    for (let i = 1; i < worker.frames.length; i++) {
      expect(worker.frames[i]!.timestamp).toBeGreaterThan(worker.frames[i - 1]!.timestamp);
    }
    expect(blob.type).toBe("video/mp4");
    expect(blob.size).toBe(4);
    expect(progress.at(-1)).toBe(1);
    expect(worker.terminated).toBe(true);
    expect(worker.cancelled).toBe(false);
  });

  it("cancels without a file and terminates the worker", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    let paints = 0;
    await expect(
      encodeRadarClip({
        size: 1080,
        fps: 30,
        ticks: [1, 2, 3, 4],
        codec: "avc1.640028",
        bitrate: 1,
        signal: controller.signal,
        paintFrame: () => {
          paints += 1;
          if (paints === 2) controller.abort();
        },
        createWorker: () => worker,
        createCanvas: () => canvas(),
        takeBitmap: () => ({ close: vi.fn() }) as unknown as ImageBitmap,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminated).toBe(true);
    expect(worker.cancelled).toBe(true);
  });

  it("does not start a worker for an empty or already cancelled export", async () => {
    const createWorker = vi.fn();
    await expect(
      encodeRadarClip({
        size: 1080,
        fps: 30,
        ticks: [],
        codec: "avc1.640028",
        bitrate: 1,
        paintFrame: () => {},
        createWorker,
      }),
    ).rejects.toThrow(CLIP_EXPORT_TOO_SHORT);
    const controller = new AbortController();
    controller.abort();
    await expect(
      encodeRadarClip({
        size: 1080,
        fps: 30,
        ticks: [1],
        codec: "avc1.640028",
        bitrate: 1,
        signal: controller.signal,
        paintFrame: () => {},
        createWorker,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("rejects a worker error without producing a file", async () => {
    const worker = new FakeWorker();
    worker.failOnStart = true;
    await expect(
      encodeRadarClip({
        size: 1440,
        fps: 60,
        ticks: [1, 2],
        codec: "avc1.640033",
        bitrate: 1,
        paintFrame: () => {},
        createWorker: () => worker,
        createCanvas: (size) => ({
          width: size,
          height: size,
          getContext: () => null,
        }),
        takeBitmap: () => ({ close: vi.fn() }) as unknown as ImageBitmap,
      }),
    ).rejects.toThrow("no encoder");
    expect(worker.terminated).toBe(true);
  });
});

describe("clip export bundles", () => {
  const dir = dirname(fileURLToPath(import.meta.url));

  it("keeps the muxer out of the panel and the main clip module", () => {
    const panel = readFileSync(join(dir, "../../components/playback/ClipExport.tsx"), "utf8");
    const runner = readFileSync(join(dir, "runClipExport.ts"), "utf8");
    const recorder = readFileSync(join(dir, "radarClip.ts"), "utf8");
    const encode = readFileSync(join(dir, "radarClipEncode.ts"), "utf8");
    expect(panel).not.toContain("mp4-muxer");
    expect(panel).not.toContain("radarClipEncode.worker");
    expect(panel).not.toContain("radarClipEncode");
    expect(runner).toContain('import("@/lib/export/radarClipEncode")');
    expect(runner).not.toContain("mp4-muxer");
    expect(recorder).not.toContain("mp4-muxer");
    expect(encode).not.toContain('from "mp4-muxer"');
    expect(readFileSync(join(dir, "radarClipEncodeSession.ts"), "utf8")).toContain("mp4-muxer");
  });
});
