import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeRadarClip } from "@/lib/export/radarClipEncode";
import { runClipExport, type RunClipExportInput } from "@/lib/export/runClipExport";
import {
  radarClipHold,
  registerRadarClipSurface,
  setRadarClipHold,
} from "@/lib/radar/radarClipSurface";

vi.mock("@/lib/export/radarClipEncode", () => ({
  encodeRadarClip: vi.fn(async () => new Blob(["clip"], { type: "video/mp4" })),
}));

vi.mock("@/lib/shared/download", () => ({
  downloadBlob: vi.fn(),
}));

function input(signal: AbortSignal): RunClipExportInput {
  return {
    choice: {
      path: "webcodecs",
      codec: "avc1.640028",
      bitrate: 1,
      width: 1920,
      height: 1080,
      fps: 30,
    },
    span: { startTick: 0, endTick: 128 },
    rate: 64,
    fps: 30,
    size: 1080,
    mapName: "de_mirage",
    roundSlug: "r1",
    restoreTick: 10,
    onTick: vi.fn(),
    onProgress: vi.fn(),
    onPlaying: vi.fn(),
    signal,
  };
}

afterEach(() => {
  registerRadarClipSurface(null);
  setRadarClipHold(false);
  document.querySelectorAll(".clip-page-host-slot").forEach((node) => node.remove());
  vi.clearAllMocks();
});

describe("runClipExport cancel during prepare", () => {
  it("encodes nothing, drops the slot, and releases the radar hold", async () => {
    const controller = new AbortController();
    let releasePrepare: () => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const slot = document.createElement("div");
    slot.className = "clip-page-host-slot";
    const paintFrame = vi.fn();
    registerRadarClipSurface({
      canvas: document.createElement("canvas"),
      paintAt() {
        return undefined;
      },
      paintFrame,
      prepareClipHud() {
        document.body.appendChild(slot);
        markStarted();
        return new Promise<void>((resolve) => {
          releasePrepare = resolve;
        });
      },
      releaseClipHud() {
        slot.remove();
      },
    });

    const onTick = vi.fn();
    const pending = runClipExport({ ...input(controller.signal), onTick });
    await started;
    expect(radarClipHold()).toBe(true);
    controller.abort();
    releasePrepare();
    await pending;

    expect(encodeRadarClip).not.toHaveBeenCalled();
    expect(paintFrame).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".clip-page-host-slot")).toHaveLength(0);
    expect(radarClipHold()).toBe(false);
    expect(onTick).toHaveBeenCalledWith(10);
  });

  it("encodes after prepare when the export is still running", async () => {
    registerRadarClipSurface({
      canvas: document.createElement("canvas"),
      paintAt() {
        return undefined;
      },
      paintFrame: vi.fn(),
      prepareClipHud: async () => undefined,
      releaseClipHud() {
        return undefined;
      },
    });
    await runClipExport(input(new AbortController().signal));
    expect(encodeRadarClip).toHaveBeenCalledTimes(1);
    expect(radarClipHold()).toBe(false);
  });
});
