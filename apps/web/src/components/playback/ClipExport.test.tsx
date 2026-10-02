import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_NO_PLANT,
  CLIP_EXPORT_NOT_READY,
  CLIP_EXPORT_REALTIME_HINT,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import { makeBombEvent, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { defaultUserSettings } from "@/lib/settings/userSettings";
import { ClipExport } from "./ClipExport";

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  encode: vi.fn(),
  download: vi.fn(),
  hold: vi.fn(),
  probe: vi.fn(),
  settings: vi.fn(),
  surface: vi.fn(
    (): {
      canvas: HTMLCanvasElement;
      paintAt: (tick: number) => void;
      paintSquare: () => void;
    } | null => ({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
      paintSquare: vi.fn(),
    }),
  ),
}));

vi.mock("@/lib/export/radarClip", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export/radarClip")>();
  return { ...actual, recordRadarClip: mocks.record };
});

vi.mock("@/lib/export/radarClipEncode", () => ({
  encodeRadarClip: mocks.encode,
}));

vi.mock("@/lib/export/clipEncodeSupport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export/clipEncodeSupport")>();
  return { ...actual, probeClipEncoder: mocks.probe };
});

vi.mock("@/lib/settings/useUserSettings", () => ({
  useUserSettings: () => mocks.settings(),
}));

vi.mock("@/lib/shared/download", () => ({
  downloadBlob: mocks.download,
}));

vi.mock("@/lib/radar/radarClipSurface", () => ({
  radarClipSurface: () => mocks.surface(),
  setRadarClipHold: mocks.hold,
  radarClipHold: () => false,
  registerRadarClipSurface: vi.fn(),
}));

const RATE = 64;

function webcodecs(fps = CLIP_EXPORT_FPS, size = 1080) {
  return {
    path: "webcodecs" as const,
    codec: "avc1.640028",
    bitrate: 12_000_000,
    width: size,
    height: size,
    fps,
  };
}

function settingsApi(settings = defaultUserSettings()) {
  return {
    settings,
    ready: true,
    saveError: null,
    update: vi.fn(),
    reset: vi.fn(),
  };
}

function props(overrides: Partial<Parameters<typeof ClipExport>[0]> = {}) {
  const round = makeRound({
    number: 3,
    start_tick: 0,
    freeze_end_tick: 2 * RATE,
    end_tick: 90 * RATE,
  });
  return {
    replay: makeReplay({
      header: { map_name: "de_mirage", tick_rate: RATE, playback_ticks: 200 * RATE },
      rounds: [round],
    }),
    tick: 2 * RATE + 40 * RATE,
    round,
    onTick: vi.fn(),
    onPlaying: vi.fn(),
    ...overrides,
  };
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Export clip" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Download clip" })).toBeEnabled());
}

describe("ClipExport", () => {
  beforeEach(() => {
    mocks.record.mockReset();
    mocks.encode.mockReset();
    mocks.download.mockReset();
    mocks.hold.mockReset();
    mocks.probe.mockReset();
    mocks.settings.mockReset();
    mocks.surface.mockReset();
    mocks.probe.mockResolvedValue(webcodecs());
    mocks.settings.mockReturnValue(settingsApi());
    mocks.surface.mockReturnValue({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
      paintSquare: vi.fn(),
    });
  });

  it("opens on the full live round", async () => {
    const user = userEvent.setup();
    render(<ClipExport {...props({ tick: 2 * RATE })} />);
    await openPanel(user);
    expect(screen.getByText("91.0s")).toBeInTheDocument();
    expect(screen.getByText("Start 0:00.0")).toBeInTheDocument();
    expect(screen.getByText("End 1:31.0")).toBeInTheDocument();
    expect(screen.getByText("1080×1080 · 30 fps · encoded on this device")).toBeInTheDocument();
  });

  it("disables post-plant without a plant", async () => {
    const user = userEvent.setup();
    render(<ClipExport {...props()} />);
    await openPanel(user);
    expect(screen.getByRole("button", { name: "Post-plant retake" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Post-plant retake" })).toHaveAttribute(
      "title",
      CLIP_EXPORT_NO_PLANT,
    );
    expect(screen.queryByRole("button", { name: "Site entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Around a kill" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark start" })).not.toBeInTheDocument();
  });

  it("runs post-plant through the win panel, not the live end tick", async () => {
    const user = userEvent.setup();
    const planted = props();
    planted.replay = makeReplay({
      header: { map_name: "de_mirage", tick_rate: RATE, playback_ticks: 0 },
      rounds: [planted.round!],
      bombEvents: [makeBombEvent({ tick: 2 * RATE + 30 * RATE, kind: "planted" })],
    });
    render(<ClipExport {...planted} />);
    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Post-plant retake" }));
    expect(screen.getByText("61.0s")).toBeInTheDocument();
    expect(screen.getByText("Start 0:30.0")).toBeInTheDocument();
    expect(screen.getByText("End 1:31.0")).toBeInTheDocument();
  });

  it("stops the last round at the last sample when playback_ticks is 0", async () => {
    const user = userEvent.setup();
    const last = props();
    const sample = 90 * RATE + RATE;
    const ticks = makeTicks(0, 1);
    ticks.ticks[0] = sample;
    last.replay = makeReplay({
      header: { map_name: "de_mirage", tick_rate: RATE, playback_ticks: 0 },
      rounds: [last.round!],
      ticks,
    });
    render(<ClipExport {...last} />);
    await openPanel(user);
    expect(screen.getByText("89.0s")).toBeInTheDocument();
    expect(screen.queryByText("91.0s")).not.toBeInTheDocument();
  });

  it("downloads an offline clip at the preference size and 30 fps", async () => {
    const user = userEvent.setup();
    const settings = defaultUserSettings();
    settings.clipExportSize = 1440;
    mocks.settings.mockReturnValue(settingsApi(settings));
    mocks.probe.mockResolvedValue(webcodecs(CLIP_EXPORT_FPS, 1440));
    const onPlaying = vi.fn();
    let release: (blob: Blob) => void = () => {};
    mocks.encode.mockImplementation(
      (opts: { onProgress?: (ratio: number) => void }) =>
        new Promise<Blob>((resolve) => {
          opts.onProgress?.(0.4);
          release = resolve;
        }),
    );
    render(<ClipExport {...props({ onPlaying })} />);
    await openPanel(user);
    expect(screen.getByText("1440×1440 · 30 fps · encoded on this device")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    expect(
      await screen.findByRole("progressbar", { name: "Clip export progress" }),
    ).toBeInTheDocument();
    release(new Blob(["vid"], { type: "video/mp4" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalled());

    const recorded = mocks.encode.mock.calls[0]?.[0] as {
      ticks: number[];
      size: number;
      fps: number;
    };
    expect(recorded.size).toBe(1440);
    expect(recorded.fps).toBe(CLIP_EXPORT_FPS);
    const coverTicks = 90 * RATE + 3 * RATE + 1 - 2 * RATE;
    expect(recorded.ticks).toHaveLength(Math.round((coverTicks / RATE) * CLIP_EXPORT_FPS));
    expect(recorded.ticks[0]).toBeLessThan(recorded.ticks[1]!);
    expect(onPlaying).toHaveBeenCalledWith(false);
    expect(mocks.hold).toHaveBeenCalledWith(true);
    expect(mocks.hold).toHaveBeenCalledWith(false);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.download).toHaveBeenCalledWith("de_mirage-r3.mp4", "video/mp4", expect.any(Blob));
  });

  it("cancels an in-progress export without a file", async () => {
    const user = userEvent.setup();
    const onTick = vi.fn();
    const tick = 2 * RATE + 20 * RATE;
    mocks.encode.mockImplementation(
      (opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("Clip export cancelled", "AbortError"));
          });
        }),
    );
    render(<ClipExport {...props({ onTick, tick })} />);
    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    await user.click(await screen.findByRole("button", { name: "Cancel clip export" }));
    await waitFor(() => expect(mocks.hold).toHaveBeenCalledWith(false));
    expect(onTick).toHaveBeenCalledWith(tick);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("explains the real-time cap when H.264 is unavailable", async () => {
    const user = userEvent.setup();
    mocks.probe.mockResolvedValue({
      path: "media-recorder",
      mime: "video/webm;codecs=vp9",
    });
    const view = props({ tick: 2 * RATE + 5 * RATE });
    view.replay = makeReplay({
      header: { map_name: "de_mirage", tick_rate: RATE, playback_ticks: 200 * RATE },
      rounds: [view.round!],
      bombEvents: [makeBombEvent({ tick: 90 * RATE - 8 * RATE, kind: "planted" })],
    });
    render(<ClipExport {...view} />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    expect(await screen.findByText(CLIP_EXPORT_REALTIME_HINT)).toBeInTheDocument();
    expect(screen.getByText(/at most 30 seconds/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download clip" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Post-plant retake" }));
    expect(screen.getByRole("button", { name: "Download clip" })).toBeEnabled();
    mocks.record.mockResolvedValue(new Blob(["vid"], { type: "video/webm" }));
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    await waitFor(() => expect(mocks.record).toHaveBeenCalled());
    const recorded = mocks.record.mock.calls[0]?.[0] as {
      ticks: number[];
      mimeType: string;
    };
    const plant = 90 * RATE - 8 * RATE;
    const coverEnd = 90 * RATE + 3 * RATE + 1;
    expect(recorded.ticks).toHaveLength(Math.round(((coverEnd - plant) / RATE) * CLIP_EXPORT_FPS));
    expect(recorded.mimeType).toBe("video/webm;codecs=vp9");
    expect(mocks.encode).not.toHaveBeenCalled();
  });

  it("explains when the radar or the browser cannot record", async () => {
    const user = userEvent.setup();
    mocks.surface.mockReturnValue(null);
    const { rerender } = render(<ClipExport {...props()} />);
    await openPanel(user);
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    expect(screen.getByText(CLIP_EXPORT_NOT_READY)).toBeInTheDocument();

    mocks.surface.mockReturnValue({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
      paintSquare: vi.fn(),
    });
    mocks.probe.mockResolvedValue(null);
    rerender(<ClipExport {...props()} key="next" />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    expect(await screen.findByText(CLIP_EXPORT_UNSUPPORTED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download clip" })).toBeDisabled();
  });
});
