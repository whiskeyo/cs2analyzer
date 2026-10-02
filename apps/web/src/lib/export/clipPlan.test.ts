import { describe, expect, it } from "vitest";
import { CLIP_EXPORT_FPS } from "@/lib/export/constants";
import {
  clipCoverLastTick,
  clipExportBitrate,
  clipExportHint,
  clipFrameSchedule,
  clipNextRoundStart,
  clipRoundBounds,
  clipRoundCover,
  clipSampleEndTick,
  clipSpanIssue,
  fullRoundSpan,
  plantTickInRound,
  postPlantSpan,
  selectClipEncodePath,
} from "@/lib/export/clipPlan";
import { clipFrameTimestamps, clipSpanDurationUs } from "@/lib/export/radarClip";

const RATE = 64;

function durationsOf(
  span: { startTick: number; endTick: number },
  rate: number,
  fps: number,
): number {
  return clipFrameSchedule(span, rate, fps).durations.reduce((sum, duration) => sum + duration, 0);
}

function round(freezeSec: number, endSec: number) {
  return {
    start_tick: 0,
    freeze_end_tick: freezeSec * RATE,
    end_tick: endSec * RATE,
  };
}

describe("clip frames", () => {
  it("counts frames as duration times fps and keeps timestamps monotonic", () => {
    const span = { startTick: 1000, endTick: 1000 + 10 * RATE };
    for (const fps of [CLIP_EXPORT_FPS, 60]) {
      const { ticks, timestamps } = clipFrameSchedule(span, RATE, fps);
      expect(ticks).toHaveLength(10 * fps);
      expect(timestamps).toHaveLength(10 * fps);
      expect(timestamps[0]).toBe(0);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]!);
      }
      expect(ticks[0]).toBe(1000);
      expect(ticks[ticks.length - 1]).toBeLessThan(span.endTick);
      const fileUs = durationsOf(span, RATE, fps);
      expect(fileUs).toBe(clipSpanDurationUs(span, RATE));
    }
  });

  it("gives 30 fps and 60 fps the same duration as the demo span", () => {
    const span = { startTick: 0, endTick: 2578 };
    const demoUs = Math.round((2578 * 1_000_000) / RATE);
    expect(clipSpanDurationUs(span, RATE)).toBe(demoUs);
    expect(demoUs / 1_000_000).toBeCloseTo(40.28125, 5);
    for (const fps of [CLIP_EXPORT_FPS, 60]) {
      expect(durationsOf(span, RATE, fps)).toBe(demoUs);
    }
  });

  it("places 30 fps frames between tick_stride samples", () => {
    const stride = 4;
    const ticks = clipFrameSchedule({ startTick: 0, endTick: RATE }, RATE, CLIP_EXPORT_FPS).ticks;
    const between = ticks.filter((tick) => tick % stride !== 0);
    expect(between.length).toBeGreaterThan(ticks.length / 2);
    expect(clipFrameTimestamps(0, 30)).toEqual([]);
  });
});

describe("clip presets", () => {
  const bounds = clipRoundBounds(round(2, 90));

  it("exports the full live round with no freeze", () => {
    expect(bounds).toEqual({ startTick: 2 * RATE, endTick: 90 * RATE });
    expect(fullRoundSpan(bounds)).toEqual(bounds);
    expect(clipRoundBounds({ start_tick: 10, freeze_end_tick: 0, end_tick: 50 })).toEqual({
      startTick: 10,
      endTick: 50,
    });
  });

  it("runs post-plant through the full-round cover, including a win with no final kill", () => {
    const plant = 2 * RATE + 30 * RATE;
    const live = round(2, 90);
    const sampleEnd = live.end_tick + 20 * RATE;
    const cover = clipRoundCover(live, RATE, null, sampleEnd);
    expect(postPlantSpan(cover, plant)).toEqual({
      startTick: plant,
      endTick: cover.endTick,
    });
    expect(cover.endTick).toBe(live.end_tick + 3 * RATE + 1);
    expect(postPlantSpan(cover, null)).toBeNull();
    expect(postPlantSpan(cover, cover.endTick)).toBeNull();
    expect(plantTickInRound([{ tick: plant, kind: "planted" }], live)).toBe(plant);
    expect(plantTickInRound([{ tick: plant, kind: "defused" }], live)).toBeNull();
    expect(plantTickInRound([{ tick: 90 * RATE + 5, kind: "planted" }], live)).toBeNull();

    const panel = live.end_tick + 7 * RATE;
    const exploded = { ...live, playback_end_tick: panel };
    const explosionCover = clipRoundCover(exploded, RATE, null, panel + 10 * RATE);
    expect(postPlantSpan(explosionCover, plant)?.endTick).toBe(explosionCover.endTick);
    expect(explosionCover.endTick).toBe(panel + 1);
  });

  it("keeps the win panel when playback_end_tick is recorded", () => {
    const live = round(2, 90);
    const panel = live.end_tick + 7 * RATE;
    const recorded = { ...live, playback_end_tick: panel };
    const sampleEnd = live.end_tick + 30 * RATE;
    const cover = clipRoundCover(recorded, RATE, null, sampleEnd);
    expect(clipCoverLastTick(recorded, RATE, null, sampleEnd)).toBe(panel);
    expect(cover).toEqual({ startTick: 2 * RATE, endTick: panel + 1 });
    expect(fullRoundSpan(cover)).toEqual(cover);
  });

  it("falls back to 3s after the win when playback_end_tick is 0 and samples continue", () => {
    const live = { ...round(2, 90), playback_end_tick: 0 };
    const sampleEnd = live.end_tick + 20 * RATE;
    const cover = clipRoundCover(live, RATE, clipNextRoundStart([live], 0), sampleEnd);
    expect(clipNextRoundStart([live], 0)).toBeNull();
    expect(cover.endTick).toBe(live.end_tick + 3 * RATE + 1);
  });

  it("stops the tail before the next round", () => {
    const live = round(2, 90);
    const next = {
      start_tick: live.end_tick + 2 * RATE,
      freeze_end_tick: live.end_tick + 4 * RATE,
      end_tick: live.end_tick + 40 * RATE,
    };
    expect(clipNextRoundStart([live, next], 0)).toBe(next.start_tick);
    const cover = clipRoundCover(live, RATE, next.start_tick, live.end_tick + 30 * RATE);
    expect(cover.endTick).toBe(next.start_tick);
    expect(cover.endTick).toBeLessThan(next.freeze_end_tick);
    expect(postPlantSpan(cover, live.end_tick - 10 * RATE)?.endTick).toBe(next.start_tick);

    const pastPanel = { ...live, playback_end_tick: next.start_tick + 10 * RATE };
    expect(clipRoundCover(pastPanel, RATE, next.start_tick, 0).endTick).toBe(next.start_tick);
  });

  it("clamps the last round to the last recorded sample, not playback_ticks", () => {
    const live = { ...round(2, 90), number: 24, playback_end_tick: 0 };
    const lastSample = live.end_tick + RATE;
    expect(clipSampleEndTick(new Uint32Array([live.start_tick, lastSample]))).toBe(lastSample);
    expect(clipSampleEndTick(new Uint32Array())).toBe(0);
    const cover = clipRoundCover(live, RATE, null, lastSample);
    expect(cover.endTick).toBe(lastSample + 1);
    expect(cover.endTick).toBeLessThan(live.end_tick + 3 * RATE);
    expect(clipCoverLastTick(live, RATE, null, live.end_tick)).toBe(live.end_tick);
    const truncated = live.end_tick - 2 * RATE;
    expect(clipRoundCover(live, RATE, null, truncated).endTick).toBe(truncated + 1);
  });

  it("clamps an overtime last round to the last recorded sample", () => {
    const ot1 = { ...round(2, 40), number: 26, playback_end_tick: 0 };
    const lastSample = ot1.end_tick + 2 * RATE;
    const cover = clipRoundCover(ot1, RATE, null, lastSample);
    expect(cover.endTick).toBe(lastSample + 1);
    expect(postPlantSpan(cover, ot1.end_tick - 8 * RATE)?.endTick).toBe(cover.endTick);

    const ot2 = { ...round(2, 40), number: 31, playback_end_tick: 0 };
    const longBuffer = ot2.end_tick + 20 * RATE;
    expect(clipRoundCover(ot2, RATE, null, longBuffer).endTick).toBe(ot2.end_tick + 3 * RATE + 1);
  });
});

describe("clip encoder selection", () => {
  it("uses WebCodecs only when H.264 is supported, else the real-time recorder", () => {
    expect(
      selectClipEncodePath({
        videoEncoder: true,
        h264: true,
        mediaRecorderMime: "video/webm",
      }),
    ).toBe("webcodecs");
    expect(
      selectClipEncodePath({
        videoEncoder: true,
        h264: false,
        mediaRecorderMime: "video/webm;codecs=vp9",
      }),
    ).toBe("media-recorder");
    expect(
      selectClipEncodePath({
        videoEncoder: false,
        h264: false,
        mediaRecorderMime: "video/mp4",
      }),
    ).toBe("media-recorder");
    expect(
      selectClipEncodePath({
        videoEncoder: false,
        h264: false,
        mediaRecorderMime: null,
      }),
    ).toBeNull();
    expect(
      selectClipEncodePath({
        videoEncoder: true,
        h264: false,
        mediaRecorderMime: null,
      }),
    ).toBeNull();
  });

  it("caps only the real-time path and describes why that export is slower", () => {
    const long = { startTick: 0, endTick: 45 * RATE };
    expect(clipSpanIssue(long, RATE, "webcodecs")).toBeNull();
    expect(clipSpanIssue(long, RATE, "media-recorder")).toBe("too-long");
    expect(clipSpanIssue({ startTick: 4, endTick: 4 }, RATE, "webcodecs")).toBe("empty");
    expect(clipExportHint("media-recorder", 1080)).toMatch(/real time/);
    expect(clipExportHint("media-recorder", 1080)).toMatch(/30 seconds/);
    expect(clipExportHint("webcodecs", 1440)).toBe("1440×1440 · 30 fps · encoded on this device");
    expect(clipExportBitrate(1080)).toBe(12_000_000);
    expect(clipExportBitrate(1440)).toBe(20_000_000);
  });
});
