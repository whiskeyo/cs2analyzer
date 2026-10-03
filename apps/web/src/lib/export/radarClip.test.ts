import { describe, expect, it, vi } from "vitest";
import {
  CLIP_EXPORT_EMPTY,
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_MAX_SECONDS,
  CLIP_EXPORT_NO_CANVAS,
  CLIP_EXPORT_TAB_HIDDEN,
  CLIP_EXPORT_TOO_SHORT,
  CLIP_EXPORT_VIDEO_BITS_PER_SECOND,
} from "@/lib/export/constants";
import {
  clipDownloadName,
  clipDurationSeconds,
  clipFrameClock,
  clipFrameTicks,
  clipSpanDurationUs,
  clipRangeIssue,
  clipRoundSlug,
  defaultClipSpan,
  lastSecondsSpan,
  preferredClipMime,
  recordRadarClip,
  roundWindowSpan,
  type RadarClipRecorder,
} from "@/lib/export/radarClip";

const RATE = 64;

class FakeRecorder implements RadarClipRecorder {
  mimeType = "video/webm;codecs=vp9";
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  bits = 0;
  mime = "";

  constructor(bits: number, mime: string) {
    this.bits = bits;
    this.mime = mime;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["frame"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function fakeCanvas(manual: boolean) {
  const stop = vi.fn();
  const requestFrame = vi.fn();
  const captureStream = vi.fn((fps: number) => {
    const track = {
      stop,
      ...(manual && fps === 0 ? { requestFrame } : {}),
    };
    return {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
  });
  return {
    canvas: { captureStream } as unknown as HTMLCanvasElement,
    captureStream,
    requestFrame,
    stop,
  };
}

describe("clip ranges", () => {
  const bounds = { startTick: 0, endTick: 100 * RATE };

  it("takes the last N seconds and never crosses the bound or the max", () => {
    expect(lastSecondsSpan(50 * RATE, 15, bounds, RATE)).toEqual({
      startTick: 35 * RATE,
      endTick: 50 * RATE,
    });
    expect(lastSecondsSpan(10 * RATE, 15, bounds, RATE)).toEqual({
      startTick: 0,
      endTick: 10 * RATE,
    });
    expect(lastSecondsSpan(80 * RATE, 100, bounds, RATE)).toEqual({
      startTick: 50 * RATE,
      endTick: 80 * RATE,
    });
  });

  it("looks forward when the playhead has no history yet", () => {
    expect(defaultClipSpan(0, bounds, RATE)).toEqual({
      startTick: 0,
      endTick: 15 * RATE,
    });
    expect(defaultClipSpan(40 * RATE, bounds, RATE)).toEqual({
      startTick: 25 * RATE,
      endTick: 40 * RATE,
    });
  });

  it("exports a short round whole and keeps the playhead inside a long one", () => {
    const short = { startTick: 2 * RATE, endTick: 20 * RATE };
    expect(roundWindowSpan(8 * RATE, short, RATE)).toEqual(short);

    const long = { startTick: 0, endTick: 100 * RATE };
    expect(roundWindowSpan(5 * RATE, long, RATE)).toEqual({
      startTick: 0,
      endTick: CLIP_EXPORT_MAX_SECONDS * RATE,
    });
    expect(roundWindowSpan(50 * RATE, long, RATE)).toEqual({
      startTick: 20 * RATE,
      endTick: 50 * RATE,
    });
    expect(roundWindowSpan(100 * RATE, long, RATE)).toEqual({
      startTick: 70 * RATE,
      endTick: 100 * RATE,
    });
  });

  it("rejects an empty or over-long continuous range", () => {
    expect(clipRangeIssue({ startTick: 10, endTick: 10 }, RATE)).toBe("empty");
    expect(clipRangeIssue({ startTick: 20, endTick: 10 }, RATE)).toBe("empty");
    expect(clipRangeIssue({ startTick: 0, endTick: CLIP_EXPORT_MAX_SECONDS * RATE }, RATE)).toBe(
      null,
    );
    expect(
      clipRangeIssue({ startTick: 0, endTick: CLIP_EXPORT_MAX_SECONDS * RATE + 1 }, RATE),
    ).toBe("too-long");
    expect(clipDurationSeconds({ startTick: 0, endTick: 15 * RATE }, RATE)).toBe(15);
  });
});

describe("clip frames", () => {
  it("samples a continuous 30 fps tick range when fps is omitted", () => {
    const span = { startTick: 1000, endTick: 1000 + 15 * RATE };
    const ticks = clipFrameTicks(span, RATE);
    expect(ticks).toHaveLength(15 * CLIP_EXPORT_FPS);
    expect(CLIP_EXPORT_FPS).toBe(30);
    expect(ticks[0]).toBe(1000);
    expect(ticks[ticks.length - 1]).toBeLessThan(span.endTick);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(RATE / CLIP_EXPORT_FPS);
    }
    expect(clipFrameTicks({ startTick: 5, endTick: 5 }, RATE)).toEqual([]);
  });
});

describe("clip file name", () => {
  it("prefers mp4, then webm, and names the download from the map and round", () => {
    expect(preferredClipMime((mime) => mime === "video/mp4" || mime.startsWith("video/webm"))).toBe(
      "video/mp4",
    );
    expect(preferredClipMime((mime) => mime.startsWith("video/webm"))).toBe(
      "video/webm;codecs=vp9",
    );
    expect(preferredClipMime(() => false)).toBeNull();
    expect(
      preferredClipMime(() => {
        throw new Error("nope");
      }),
    ).toBeNull();

    expect(clipDownloadName("de_mirage", "r12", "video/webm;codecs=vp9")).toBe(
      "de_mirage-r12.webm",
    );
    expect(
      clipDownloadName("maps/de_dust2", clipRoundSlug({ number: 0, is_knife: true }), "video/mp4"),
    ).toBe("de_dust2-knife.mp4");
  });
});

describe("recordRadarClip", () => {
  function clocked() {
    let clock = 0;
    const sleeps: number[] = [];
    return {
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      sleeps,
    };
  }

  it("pushes one manual frame per tick and paces at the default 30 fps", async () => {
    const { canvas, captureStream, requestFrame, stop } = fakeCanvas(true);
    const recorder = new FakeRecorder(0, "");
    const painted: number[] = [];
    const time = clocked();
    const ticks = [10, 11, 12];
    const blob = await recordRadarClip({
      canvas,
      ticks,
      mimeType: "video/webm;codecs=vp9",
      paintAt: (tick) => {
        painted.push(tick);
      },
      now: time.now,
      sleep: time.sleep,
      createRecorder: (_stream, mime, bits) => {
        recorder.bits = bits;
        recorder.mime = mime;
        return recorder;
      },
    });

    expect(captureStream).toHaveBeenCalledTimes(1);
    expect(captureStream).toHaveBeenCalledWith(0);
    expect(requestFrame).toHaveBeenCalledTimes(ticks.length);
    expect(painted).toEqual([10, 10, 11, 12]);
    expect(time.sleeps).toHaveLength(ticks.length);
    expect(time.sleeps[0]).toBeCloseTo(1000 / CLIP_EXPORT_FPS);
    expect(recorder.bits).toBe(CLIP_EXPORT_VIDEO_BITS_PER_SECOND);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain("webm");
    expect(stop).toHaveBeenCalled();
  });

  it("falls back to a timed capture stream when frames cannot be requested", async () => {
    const { canvas, captureStream } = fakeCanvas(false);
    const time = clocked();
    await recordRadarClip({
      canvas,
      ticks: [1, 2],
      mimeType: "video/mp4",
      paintAt: () => {},
      now: time.now,
      sleep: time.sleep,
      createRecorder: (_stream, mime, bits) => new FakeRecorder(bits, mime),
    });
    expect(captureStream.mock.calls.map((call) => call[0])).toEqual([0, CLIP_EXPORT_FPS]);
  });

  it("holds each frame so 30 fps and 60 fps last as long as the demo span", async () => {
    const span = { startTick: 0, endTick: 2578 };
    const demoMs = clipSpanDurationUs(span, RATE) / 1000;
    for (const fps of [CLIP_EXPORT_FPS, 60]) {
      const clock = clipFrameClock(span, RATE, fps);
      const { canvas } = fakeCanvas(true);
      const time = clocked();
      await recordRadarClip({
        canvas,
        ticks: clock.ticks,
        holdMs: clock.durations.map((us) => us / 1000),
        fps,
        mimeType: "video/webm",
        paintAt: () => {},
        now: time.now,
        sleep: time.sleep,
        createRecorder: (_stream, mime, bits) => new FakeRecorder(bits, mime),
      });
      const held = time.sleeps.reduce((sum, ms) => sum + ms, 0);
      expect(held).toBeCloseTo(demoMs, 5);
    }
  });

  function stubVisibility(initial: "visible" | "hidden") {
    const listeners = new Set<() => void>();
    let visibilityState: "visible" | "hidden" = initial;
    vi.stubGlobal("document", {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener(type: string, fn: () => void) {
        if (type === "visibilitychange") listeners.add(fn);
      },
      removeEventListener(_type: string, fn: () => void) {
        listeners.delete(fn);
      },
    });
    return {
      hide() {
        visibilityState = "hidden";
        for (const fn of listeners) fn();
      },
    };
  }

  it("refuses to start when the tab is already hidden", async () => {
    stubVisibility("hidden");
    try {
      const { canvas, captureStream } = fakeCanvas(true);
      await expect(
        recordRadarClip({
          canvas,
          ticks: [1, 2],
          mimeType: "video/webm",
          paintAt: () => {},
          createRecorder: () => new FakeRecorder(0, ""),
        }),
      ).rejects.toThrow(CLIP_EXPORT_TAB_HIDDEN);
      expect(captureStream).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts without a file when the tab is hidden mid-recording", async () => {
    const page = stubVisibility("visible");
    let release = () => {};
    const hung = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const { canvas } = fakeCanvas(true);
      const pending = recordRadarClip({
        canvas,
        ticks: [1, 2, 3],
        mimeType: "video/webm",
        paintAt: () => {},
        now: () => 0,
        sleep: () => hung,
        createRecorder: (_stream, mime, bits) => new FakeRecorder(bits, mime),
      });
      page.hide();
      const error = await pending.then(
        () => {
          throw new Error("recording resolved");
        },
        (err: unknown) => err,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).not.toBe("AbortError");
      expect((error as Error).message).toBe(CLIP_EXPORT_TAB_HIDDEN);
    } finally {
      release();
      vi.unstubAllGlobals();
    }
  });

  it("cancels without a blob when the signal aborts", async () => {
    const { canvas } = fakeCanvas(true);
    const controller = new AbortController();
    const time = clocked();
    let paints = 0;
    await expect(
      recordRadarClip({
        canvas,
        ticks: [1, 2, 3, 4],
        mimeType: "video/webm",
        signal: controller.signal,
        now: time.now,
        sleep: time.sleep,
        paintAt: () => {
          paints += 1;
          if (paints === 3) controller.abort();
        },
        createRecorder: (_stream, mime, bits) => new FakeRecorder(bits, mime),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(paints).toBe(3);
  });

  it("does not start when the signal is already aborted or the range is empty", async () => {
    const { canvas, captureStream } = fakeCanvas(true);
    const controller = new AbortController();
    controller.abort();
    await expect(
      recordRadarClip({
        canvas,
        ticks: [1],
        mimeType: "video/webm",
        signal: controller.signal,
        paintAt: () => {},
        createRecorder: () => new FakeRecorder(0, ""),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(captureStream).not.toHaveBeenCalled();

    await expect(
      recordRadarClip({
        canvas,
        ticks: [],
        mimeType: "video/webm",
        paintAt: () => {},
        createRecorder: () => new FakeRecorder(0, ""),
      }),
    ).rejects.toThrow(CLIP_EXPORT_TOO_SHORT);
  });

  it("reports a missing canvas recorder and an empty recording", async () => {
    await expect(
      recordRadarClip({
        canvas: {} as HTMLCanvasElement,
        ticks: [1],
        mimeType: "video/webm",
        paintAt: () => {},
        createRecorder: () => new FakeRecorder(0, ""),
      }),
    ).rejects.toThrow(CLIP_EXPORT_NO_CANVAS);

    const { canvas } = fakeCanvas(true);
    const empty = new FakeRecorder(0, "");
    empty.stop = () => {
      empty.state = "inactive";
      empty.onstop?.();
    };
    await expect(
      recordRadarClip({
        canvas,
        ticks: [1],
        mimeType: "video/webm",
        paintAt: () => {},
        now: () => 0,
        sleep: async () => {},
        createRecorder: () => empty,
      }),
    ).rejects.toThrow(CLIP_EXPORT_EMPTY);
  });
});
