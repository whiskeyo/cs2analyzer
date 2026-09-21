import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_NOT_READY,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { ClipExport } from "./ClipExport";

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  download: vi.fn(),
  hold: vi.fn(),
  surface: vi.fn((): { canvas: HTMLCanvasElement; paintAt: (tick: number) => void } | null => ({
    canvas: { width: 640, height: 480 } as HTMLCanvasElement,
    paintAt: vi.fn(),
  })),
}));

vi.mock("@/lib/export/radarClip", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export/radarClip")>();
  return { ...actual, recordRadarClip: mocks.record };
});

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

function props(overrides: Partial<Parameters<typeof ClipExport>[0]> = {}) {
  const round = makeRound({
    number: 3,
    start_tick: 0,
    freeze_end_tick: 2 * RATE,
    end_tick: 90 * RATE,
  });
  return {
    replay: makeReplay({
      header: { map_name: "de_mirage", tick_rate: RATE },
      rounds: [round],
    }),
    tick: 2 * RATE + 40 * RATE,
    round,
    minTick: 2 * RATE,
    maxTick: 80 * RATE,
    onTick: vi.fn(),
    onPlaying: vi.fn(),
    ...overrides,
  };
}

describe("ClipExport", () => {
  beforeEach(() => {
    mocks.record.mockReset();
    mocks.download.mockReset();
    mocks.hold.mockReset();
    mocks.surface.mockReset();
    mocks.surface.mockReturnValue({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
    });
    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: (mime: string) => mime === "video/webm;codecs=vp9",
    });
  });

  it("opens on the last 15 seconds and can switch to the round window", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ClipExport {...props()} />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    expect(screen.getByRole("region", { name: "Radar clip export" })).toBeInTheDocument();
    expect(screen.getByText("15.0s")).toBeInTheDocument();
    expect(screen.getByText("Start 0:25.0")).toBeInTheDocument();
    expect(screen.getByText("End 0:40.0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Last 30 seconds" }));
    expect(screen.getByText("30.0s")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "This round" }));
    expect(screen.getByText("30.0s")).toBeInTheDocument();

    const short = props({
      tick: 2 * RATE + 8 * RATE,
      maxTick: 2 * RATE + 18 * RATE,
    });
    rerender(<ClipExport {...short} />);
    await user.click(screen.getByRole("button", { name: "This round" }));
    expect(screen.getByText("18.0s")).toBeInTheDocument();
  });

  it("blocks a marked range longer than 30 seconds", async () => {
    const user = userEvent.setup();
    const view = props({ tick: 2 * RATE + 5 * RATE });
    const { rerender } = render(<ClipExport {...view} />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    await user.click(screen.getByRole("button", { name: "Mark start" }));
    rerender(<ClipExport {...view} tick={2 * RATE + 45 * RATE} />);
    await user.click(screen.getByRole("button", { name: "Mark end" }));
    expect(screen.getByText("Clips can be at most 30 seconds.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download clip" })).toBeDisabled();
  });

  it("downloads a continuous clip from the live radar", async () => {
    const user = userEvent.setup();
    const onTick = vi.fn();
    const onPlaying = vi.fn();
    mocks.record.mockImplementation(
      async (opts: {
        ticks: number[];
        onFrame?: (i: number, t: number) => void;
        mimeType: string;
      }) => {
        opts.onFrame?.(0, opts.ticks[0]);
        opts.onFrame?.(opts.ticks.length - 1, opts.ticks[opts.ticks.length - 1]);
        return new Blob(["vid"], { type: "video/webm" });
      },
    );
    render(<ClipExport {...props({ onTick, onPlaying })} />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalled());

    const recorded = mocks.record.mock.calls[0]?.[0] as { ticks: number[]; mimeType: string };
    expect(recorded.ticks).toHaveLength(15 * CLIP_EXPORT_FPS);
    expect(recorded.ticks[0]).toBeLessThan(recorded.ticks[1]);
    expect(recorded.mimeType).toBe("video/webm;codecs=vp9");
    expect(onPlaying).toHaveBeenCalledWith(false);
    expect(mocks.hold).toHaveBeenCalledWith(true);
    expect(mocks.hold).toHaveBeenCalledWith(false);
    expect(mocks.download).toHaveBeenCalledWith(
      "de_mirage-r3.webm",
      "video/webm",
      expect.any(Blob),
    );
  });

  it("cancels an in-progress recording", async () => {
    const user = userEvent.setup();
    const onTick = vi.fn();
    const tick = 2 * RATE + 20 * RATE;
    mocks.record.mockImplementation(
      (opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("Clip export cancelled", "AbortError"));
          });
        }),
    );
    render(<ClipExport {...props({ onTick, tick })} />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    await user.click(await screen.findByRole("button", { name: "Cancel clip export" }));
    await waitFor(() => expect(mocks.hold).toHaveBeenCalledWith(false));
    expect(onTick).toHaveBeenCalledWith(tick);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("explains when the radar or the browser cannot record", async () => {
    const user = userEvent.setup();
    mocks.surface.mockReturnValue(null);
    const { rerender } = render(<ClipExport {...props()} />);
    await user.click(screen.getByRole("button", { name: "Export clip" }));
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    expect(screen.getByText(CLIP_EXPORT_NOT_READY)).toBeInTheDocument();

    mocks.surface.mockReturnValue({
      canvas: { width: 640, height: 480 } as HTMLCanvasElement,
      paintAt: vi.fn(),
    });
    vi.stubGlobal("MediaRecorder", undefined);
    rerender(<ClipExport {...props()} />);
    await user.click(screen.getByRole("button", { name: "Download clip" }));
    expect(screen.getByText(CLIP_EXPORT_UNSUPPORTED)).toBeInTheDocument();
  });
});
