import { describe, expect, it } from "vitest";
import { CLIP_EXPORT_FPS_DEFAULT, CLIP_EXPORT_FPS_SMOOTH } from "@/lib/export/constants";
import {
  aroundKillSpan,
  clipExportBitrate,
  clipExportHint,
  clipFrameSchedule,
  clipRoundBounds,
  clipSpanIssue,
  firstExecuteActionTick,
  fullRoundSpan,
  killsInRound,
  nearestKillTick,
  plantTickInRound,
  postPlantSpan,
  selectClipEncodePath,
  siteEntrySpan,
} from "@/lib/export/clipPlan";
import { clipFrameTimestamps } from "@/lib/export/radarClip";

const RATE = 64;

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
    for (const fps of [CLIP_EXPORT_FPS_DEFAULT, CLIP_EXPORT_FPS_SMOOTH]) {
      const { ticks, timestamps } = clipFrameSchedule(span, RATE, fps);
      expect(ticks).toHaveLength(10 * fps);
      expect(timestamps).toHaveLength(10 * fps);
      expect(timestamps[0]).toBe(0);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]!);
      }
      expect(ticks[0]).toBe(1000);
      expect(ticks[ticks.length - 1]).toBeLessThan(span.endTick);
    }
  });

  it("places 60 fps frames between tick_stride samples", () => {
    const stride = 4;
    const ticks = clipFrameSchedule(
      { startTick: 0, endTick: RATE },
      RATE,
      CLIP_EXPORT_FPS_SMOOTH,
    ).ticks;
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

  it("starts site entry a few seconds before the execute and ends at the plant", () => {
    const execute = 2 * RATE + 20 * RATE;
    const plant = 2 * RATE + 40 * RATE;
    expect(siteEntrySpan(bounds, execute, plant, RATE)).toEqual({
      startTick: execute - 3 * RATE,
      endTick: plant,
    });
    expect(siteEntrySpan(bounds, execute, null, RATE)).toEqual({
      startTick: execute - 3 * RATE,
      endTick: bounds.endTick,
    });
    expect(siteEntrySpan(bounds, null, plant, RATE)).toBeNull();
  });

  it("runs post-plant from the plant to round end and disables a round with no plant", () => {
    const plant = 2 * RATE + 30 * RATE;
    expect(postPlantSpan(bounds, plant)).toEqual({
      startTick: plant,
      endTick: bounds.endTick,
    });
    expect(postPlantSpan(bounds, null)).toBeNull();
    expect(postPlantSpan(bounds, bounds.endTick)).toBeNull();
    expect(plantTickInRound([{ tick: plant, kind: "planted" }], round(2, 90))).toBe(plant);
    expect(plantTickInRound([{ tick: plant, kind: "defused" }], round(2, 90))).toBeNull();
    expect(plantTickInRound([{ tick: 90 * RATE + 5, kind: "planted" }], round(2, 90))).toBeNull();
  });

  it("clamps a kill in the first seconds and a kill at round end", () => {
    const early = bounds.startTick + 2 * RATE;
    expect(aroundKillSpan(bounds, early, RATE)).toEqual({
      startTick: bounds.startTick,
      endTick: early + 3 * RATE,
    });
    const late = bounds.endTick - RATE;
    expect(aroundKillSpan(bounds, late, RATE)).toEqual({
      startTick: late - 5 * RATE,
      endTick: bounds.endTick,
    });
    const mid = bounds.startTick + 40 * RATE;
    expect(aroundKillSpan(bounds, mid, RATE)).toEqual({
      startTick: mid - 5 * RATE,
      endTick: mid + 3 * RATE,
    });
  });

  it("picks the earliest execute and the kill nearest the playhead", () => {
    expect(
      firstExecuteActionTick(
        [
          { round: 3, kind: "plant", actionTick: 10 },
          { round: 3, kind: "execute", actionTick: 80 },
          { round: 3, kind: "execute", actionTick: 40 },
          { round: 4, kind: "execute", actionTick: 5 },
        ],
        3,
      ),
    ).toBe(40);
    expect(firstExecuteActionTick([], 3)).toBeNull();

    const kills = [{ tick: 10 }, { tick: 50 }, { tick: 90 }];
    expect(nearestKillTick(kills, 70)).toBe(50);
    expect(nearestKillTick([], 70)).toBeNull();
    expect(
      killsInRound([{ tick: -1 }, { tick: 100 }, { tick: 90 * RATE + 1 }], round(2, 90)),
    ).toEqual([{ tick: 100 }]);
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
    expect(clipExportHint("media-recorder", 1080, 30)).toMatch(/real time/);
    expect(clipExportHint("media-recorder", 1080, 30)).toMatch(/30 seconds/);
    expect(clipExportHint("webcodecs", 1440, 60)).toBe(
      "1440×1440 · 60 fps · encoded on this device",
    );
    expect(clipExportBitrate(1080, 30)).toBe(12_000_000);
    expect(clipExportBitrate(1080, 60)).toBe(24_000_000);
    expect(clipExportBitrate(1440, 30)).toBe(20_000_000);
    expect(clipExportBitrate(1440, 60)).toBe(40_000_000);
  });
});
