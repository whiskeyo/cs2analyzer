import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_FROM_PLANT,
  CLIP_EXPORT_FULL_ROUND,
  CLIP_EXPORT_NO_PLANT,
  CLIP_EXPORT_NOT_READY,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import {
  clipNextRoundStart,
  clipRoundCover,
  clipSampleEndTick,
  fullRoundSpan,
  postPlantSpan,
} from "@/lib/export/clipPlan";
import { clipFrameTicks, type ClipSpan } from "@/lib/export/radarClip";
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
      paintFrame: () => void;
    } | null => ({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
      paintFrame: vi.fn(),
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
      header: {
        map_name: "de_mirage",
        tick_rate: RATE,
        playback_ticks: 200 * RATE,
      },
      rounds: [round],
    }),
    tick: 2 * RATE + 40 * RATE,
    round,
    onTick: vi.fn(),
    onPlaying: vi.fn(),
    ...overrides,
  };
}

function coverOf(view: ReturnType<typeof props>): ClipSpan {
  const round = view.round!;
  const index = view.replay.rounds.indexOf(round);
  return clipRoundCover(
    round,
    RATE,
    clipNextRoundStart(view.replay.rounds, index),
    clipSampleEndTick(view.replay.ticks.ticks),
  );
}

function fullRoundButton() {
  return screen.getByRole("button", { name: CLIP_EXPORT_FULL_ROUND });
}

function fromPlantButton() {
  return screen.getByRole("button", { name: CLIP_EXPORT_FROM_PLANT });
}

function hangEncode() {
  let release: (blob: Blob) => void = () => {};
  mocks.encode.mockImplementation(
    () =>
      new Promise<Blob>((resolve) => {
        release = resolve;
      }),
  );
  return (blob: Blob) => release(blob);
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
      paintFrame: vi.fn(),
    });
  });

  it("puts both clip actions in the toolbar with no menu", () => {
    render(<ClipExport {...props()} />);
    const full = fullRoundButton();
    const plant = fromPlantButton();
    expect(full.tabIndex).not.toBe(-1);
    expect(plant.tabIndex).not.toBe(-1);
    expect(full).toHaveAttribute("title", CLIP_EXPORT_FULL_ROUND);
    expect(screen.queryByRole("button", { name: "Export clip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Radar clip export" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download clip" })).not.toBeInTheDocument();
  });

  it("disables from plant without a plant", async () => {
    const user = userEvent.setup();
    render(<ClipExport {...props()} />);
    const plant = fromPlantButton();
    expect(plant).toBeDisabled();
    expect(plant).toHaveAttribute("title", CLIP_EXPORT_NO_PLANT);
    await user.click(plant);
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("exports the full round from the toolbar button", async () => {
    const user = userEvent.setup();
    const settings = defaultUserSettings();
    settings.clipExportSize = 1440;
    mocks.settings.mockReturnValue(settingsApi(settings));
    mocks.probe.mockResolvedValue(webcodecs(CLIP_EXPORT_FPS, 1440));
    const onPlaying = vi.fn();
    const view = props({ onPlaying });
    const release = hangEncode();
    render(<ClipExport {...view} />);
    fullRoundButton().focus();
    expect(fullRoundButton()).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(fullRoundButton()).toBeDisabled();
    await waitFor(() => expect(mocks.encode).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Download clip" })).not.toBeInTheDocument();

    release(new Blob(["vid"], { type: "video/mp4" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalled());
    expect(fullRoundButton()).toBeEnabled();

    const recorded = mocks.encode.mock.calls[0]?.[0] as {
      ticks: number[];
      size: number;
      fps: number;
    };
    const expected = clipFrameTicks(fullRoundSpan(coverOf(view)), RATE, CLIP_EXPORT_FPS);
    expect(recorded.size).toBe(1440);
    expect(recorded.fps).toBe(CLIP_EXPORT_FPS);
    expect(recorded.ticks).toEqual(expected);
    expect(onPlaying).toHaveBeenCalledWith(false);
    expect(mocks.hold).toHaveBeenCalledWith(true);
    expect(mocks.hold).toHaveBeenCalledWith(false);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.download).toHaveBeenCalledWith("de_mirage-r3.mp4", "video/mp4", expect.any(Blob));
  });

  it("exports from plant when Space is pressed on that button", async () => {
    const user = userEvent.setup();
    const planted = props();
    planted.replay = makeReplay({
      header: { map_name: "de_mirage", tick_rate: RATE, playback_ticks: 0 },
      rounds: [planted.round!],
      bombEvents: [makeBombEvent({ tick: 2 * RATE + 30 * RATE, kind: "planted" })],
    });
    mocks.encode.mockResolvedValue(new Blob(["vid"], { type: "video/mp4" }));
    render(<ClipExport {...planted} />);
    fromPlantButton().focus();
    await user.keyboard(" ");
    await waitFor(() => expect(mocks.encode).toHaveBeenCalled());

    const recorded = mocks.encode.mock.calls[0]?.[0] as { ticks: number[] };
    const expected = clipFrameTicks(
      postPlantSpan(coverOf(planted), 2 * RATE + 30 * RATE)!,
      RATE,
      CLIP_EXPORT_FPS,
    );
    expect(recorded.ticks).toEqual(expected);
    expect(mocks.download).toHaveBeenCalled();
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
    mocks.encode.mockResolvedValue(new Blob(["vid"], { type: "video/mp4" }));
    render(<ClipExport {...last} />);
    await user.click(fullRoundButton());
    await waitFor(() => expect(mocks.encode).toHaveBeenCalled());
    const recorded = mocks.encode.mock.calls[0]?.[0] as { ticks: number[] };
    const expected = clipFrameTicks(fullRoundSpan(coverOf(last)), RATE, CLIP_EXPORT_FPS);
    expect(recorded.ticks).toEqual(expected);
    expect(expected.length).toBeLessThan(
      clipFrameTicks(
        { startTick: 2 * RATE, endTick: 90 * RATE + 3 * RATE + 1 },
        RATE,
        CLIP_EXPORT_FPS,
      ).length,
    );
  });

  it("records from plant in real time when H.264 is unavailable", async () => {
    const user = userEvent.setup();
    mocks.probe.mockResolvedValue({
      path: "media-recorder",
      mime: "video/webm;codecs=vp9",
    });
    const view = props({ tick: 2 * RATE + 5 * RATE });
    const plant = 90 * RATE - 8 * RATE;
    view.replay = makeReplay({
      header: {
        map_name: "de_mirage",
        tick_rate: RATE,
        playback_ticks: 200 * RATE,
      },
      rounds: [view.round!],
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
    });
    mocks.record.mockResolvedValue(new Blob(["vid"], { type: "video/webm" }));
    render(<ClipExport {...view} />);
    await user.click(fromPlantButton());
    await waitFor(() => expect(mocks.record).toHaveBeenCalled());
    const recorded = mocks.record.mock.calls[0]?.[0] as {
      ticks: number[];
      mimeType: string;
    };
    const expected = clipFrameTicks(postPlantSpan(coverOf(view), plant)!, RATE, CLIP_EXPORT_FPS);
    expect(recorded.ticks).toEqual(expected);
    expect(recorded.mimeType).toBe("video/webm;codecs=vp9");
    expect(mocks.encode).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith(
        "de_mirage-r3.webm",
        "video/webm",
        expect.any(Blob),
      ),
    );
  });

  it("explains when the radar or the browser cannot record", async () => {
    const user = userEvent.setup();
    mocks.surface.mockReturnValue(null);
    const { rerender } = render(<ClipExport {...props()} />);
    await user.click(fullRoundButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(CLIP_EXPORT_NOT_READY);
    expect(fullRoundButton()).toBeEnabled();

    mocks.surface.mockReturnValue({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
      paintFrame: vi.fn(),
    });
    mocks.probe.mockResolvedValue(null);
    rerender(<ClipExport {...props()} key="next" />);
    await user.click(fullRoundButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(CLIP_EXPORT_UNSUPPORTED);
    expect(screen.queryByRole("button", { name: "Download clip" })).not.toBeInTheDocument();
    expect(fullRoundButton()).toBeEnabled();
  });
});
