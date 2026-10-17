import { describe, expect, it } from "vitest";
import {
  axisScale,
  economyBreakAfter,
  nearestRoundIndex,
  percentAxis,
  plotRect,
  roundX,
  axisPixel,
  axisStrokeWidth,
  devicePixelStroke,
  roundLabelGapPx,
  roundLabelTopPx,
  snapDevicePixel,
  snapOverlayAxis,
  strokeDeviceColumn,
  smoothLinePath,
  smoothLineSegments,
  ROUND_LABEL_BAND_PX,
  ROUND_LABEL_GAP_PX,
  ROUND_LABEL_TURNED_PX,
  ROUND_LABEL_SLOT_PX,
  TIMELINE_LAYOUT,
  roundLabelBand,
  timelineLayoutForHeight,
  roundLabelOrientation,
  valueToY,
  type TimelineRoundRoster,
} from "./timelineChart";
import type { Side } from "@/lib/replay/replayTypes";

describe("timelineChart", () => {
  const plot = plotRect();

  it("covers a whole number of device pixels, the same width on both axes", () => {
    const devicePixels = [
      { dpr: 1, devicePx: 1 },
      { dpr: 1.25, devicePx: 1 },
      { dpr: 1.5, devicePx: 1 },
      { dpr: 2, devicePx: 2 },
    ];
    for (const { dpr, devicePx } of devicePixels) {
      expect(devicePixelStroke(dpr)).toBe(devicePx);
      const horizontal = axisStrokeWidth(dpr);
      const vertical = axisStrokeWidth(dpr);
      expect(horizontal).toBe(vertical);
      expect(horizontal * dpr).toBeCloseTo(devicePx, 8);
      const odd = devicePx % 2 === 1;
      for (const px of [0, 0.4, 10.2, 22, 94.37]) {
        const center = snapDevicePixel(px, dpr) * dpr;
        const fraction = center - Math.floor(center);
        expect(fraction).toBeCloseTo(odd ? 0.5 : 0, 6);
        const half = devicePx / 2;
        expect(center - half).toBeCloseTo(Math.round(center - half), 6);
        expect(center + half).toBeCloseTo(Math.round(center + half), 6);
      }
    }
    expect(snapDevicePixel(10.2, 1)).toBe(10.5);
    expect(snapDevicePixel(10.2, 1.25)).toBe(snapOverlayAxis(10.2, 0, 1.25));
    expect(snapDevicePixel(10.2, 1.5)).toBe(snapOverlayAxis(10.2, 0, 1.5));
    expect(snapDevicePixel(10.2, 2)).toBe(Math.round(10.2 * 2) / 2);
    expect(snapDevicePixel(10.2, 1)).not.toBe(snapDevicePixel(10.2, 1.25));
    expect(snapDevicePixel(10.2, 0)).toBe(snapDevicePixel(10.2, 1));
    expect(axisStrokeWidth(0)).toBe(axisStrokeWidth(1));
    expect(axisPixel(22, 280, 0, 2)).toBe(22);
    expect(axisPixel(22, 280, 938, 2)).toBe(snapDevicePixel((22 / 280) * 938, 2));
  });

  it("gives every round its own device column when the overlay origin is fractional", () => {
    const dpr = 1.5;
    const rounds = 42;
    const cases = [
      { origin: 14.260416984558105, cssWidth: 1891.479248046875 },
      { origin: 0.4, cssWidth: 1700.3 },
      { origin: 10.3, cssWidth: 2051.48 },
      { origin: 99.9, cssWidth: 1600.1 },
    ];
    for (const { origin, cssWidth } of cases) {
      const columns = Array.from({ length: rounds }, (_, index) => {
        const user = roundX(index, rounds, plot);
        const localCss = (user / TIMELINE_LAYOUT.width) * cssWidth;
        const naive = (origin + snapDevicePixel(localCss, dpr)) * dpr;
        expect(naive - Math.floor(naive)).not.toBeCloseTo(0.5, 2);
        const local = snapOverlayAxis(localCss, origin, dpr);
        const screen = origin + local;
        const device = screen * dpr;
        expect(device - Math.floor(device)).toBeCloseTo(0.5, 8);
        expect(axisPixel(user, TIMELINE_LAYOUT.width, cssWidth, dpr, origin)).toBe(local);
        return strokeDeviceColumn(screen, dpr);
      });
      expect(columns).toHaveLength(rounds);
      expect(new Set(columns).size).toBe(rounds);
    }
  });

  it("rounds the axis up onto a readable grid", () => {
    const adr = axisScale(117);
    expect(adr.max).toBeGreaterThanOrEqual(117);
    expect(adr.ticks[0]).toBe(0);
    expect(adr.ticks[adr.ticks.length - 1]).toBe(adr.max);
    expect(adr.ticks).toContain(50);
    const percent = percentAxis(80);
    expect(percent.max).toBe(100);
    expect(percent.ticks).toContain(100);
    expect(percentAxis(140).max).toBeGreaterThanOrEqual(140);
  });

  it("keeps a device-aligned gap under the baseline at every chart height", () => {
    const heights = [220, 480, 812.5, 1400];
    for (const cssHeight of heights) {
      const layout = timelineLayoutForHeight(cssHeight);
      const band = (layout.padBottom / layout.height) * cssHeight;
      expect(band).toBeCloseTo(ROUND_LABEL_BAND_PX, 6);
      expect(layout.padBottom).toBeLessThan(TIMELINE_LAYOUT.padBottom);
      const baseline = layout.height - layout.padBottom;
      const baselineCss = snapOverlayAxis((baseline / layout.height) * cssHeight, 0, 1);
      expect(roundLabelTopPx(baselineCss, 1) - baselineCss).toBe(ROUND_LABEL_GAP_PX);
    }
    expect(timelineLayoutForHeight(0)).toBe(TIMELINE_LAYOUT);
    expect(timelineLayoutForHeight(-1).padBottom).toBe(TIMELINE_LAYOUT.padBottom);
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const gap = roundLabelGapPx(dpr);
      expect(gap * dpr).toBeCloseTo(Math.round(gap * dpr), 8);
      expect(gap).toBeGreaterThan(4);
      expect(gap).toBeLessThan(6);
    }
    expect(roundLabelGapPx(1.5)).not.toBe(roundLabelGapPx(1));
  });

  it("reserves a taller band for turned labels and keeps the same gap", () => {
    const cssHeight = 480;
    const horizontal = timelineLayoutForHeight(
      cssHeight,
      TIMELINE_LAYOUT,
      roundLabelBand("horizontal"),
    );
    const vertical = timelineLayoutForHeight(
      cssHeight,
      TIMELINE_LAYOUT,
      roundLabelBand("vertical"),
    );
    const bandPx = (layout: { padBottom: number; height: number }) =>
      (layout.padBottom / layout.height) * cssHeight;
    expect(bandPx(horizontal)).toBeCloseTo(ROUND_LABEL_BAND_PX, 6);
    expect(bandPx(vertical)).toBeCloseTo(ROUND_LABEL_GAP_PX + ROUND_LABEL_TURNED_PX, 6);
    expect(vertical.padBottom).toBeGreaterThan(horizontal.padBottom);
    expect(vertical.padBottom).toBeLessThan(TIMELINE_LAYOUT.padBottom);
    for (const layout of [horizontal, vertical]) {
      const baseline = layout.height - layout.padBottom;
      const baselineCss = snapOverlayAxis((baseline / layout.height) * cssHeight, 0, 1);
      expect(roundLabelTopPx(baselineCss, 1) - baselineCss).toBe(ROUND_LABEL_GAP_PX);
    }
    expect(roundLabelBand("horizontal", 1.5)).toBeCloseTo(roundLabelGapPx(1.5) + 10, 8);
  });

  it("keeps every round label and turns the row upright when horizontal type would overlap", () => {
    expect(roundLabelOrientation(42, 42 * 40, ROUND_LABEL_SLOT_PX)).toBe("horizontal");
    expect(roundLabelOrientation(42, 42 * ROUND_LABEL_SLOT_PX, ROUND_LABEL_SLOT_PX)).toBe(
      "horizontal",
    );
    expect(roundLabelOrientation(42, 0, ROUND_LABEL_SLOT_PX)).toBe("horizontal");
    expect(roundLabelOrientation(1, 10, ROUND_LABEL_SLOT_PX)).toBe("horizontal");
    expect(roundLabelOrientation(42, 42 * 10, ROUND_LABEL_SLOT_PX)).toBe("vertical");
    expect(roundLabelOrientation(42, 42 * ROUND_LABEL_SLOT_PX - 1, ROUND_LABEL_SLOT_PX)).toBe(
      "vertical",
    );
  });

  it("maps values with zero on the baseline and the max on the top", () => {
    expect(valueToY(0, 100, plot)).toBeCloseTo(plot.y + plot.height);
    expect(valueToY(100, 100, plot)).toBeCloseTo(plot.y);
    expect(roundX(0, 2, plot)).toBeLessThan(roundX(1, 2, plot));
    expect(nearestRoundIndex(roundX(1, 4, plot), 4, plot)).toBe(1);
  });

  it("breaks a regulation match only at the side swap", () => {
    expect(economyBreakAfter(blocks(["T", 12], ["CT", 12]))).toEqual([12]);
  });

  it("breaks MR12 and two overtimes at each side swap and overtime start", () => {
    expect(economyBreakAfter(blocks(["T", 12], ["CT", 15], ["T", 6], ["CT", 3]))).toEqual([
      12, 24, 27, 30, 33,
    ]);
  });

  it("infers a non-standard MR15 regulation and overtime from the swaps", () => {
    expect(economyBreakAfter(blocks(["CT", 15], ["T", 15]))).toEqual([15]);
    expect(economyBreakAfter(blocks(["CT", 15], ["T", 18], ["CT", 3]))).toEqual([15, 30, 33]);
  });

  it("marks the Mirage 22-20 overtime breaks and no others", () => {
    expect(economyBreakAfter(blocks(["T", 12], ["CT", 15], ["T", 6], ["CT", 6], ["T", 3]))).toEqual(
      [12, 24, 27, 30, 33, 36, 39],
    );
  });

  it("does not treat a missing player as T or a late join as a side swap", () => {
    expect(
      economyBreakAfter([
        { number: 1, players: [{ player: 1, side: "CT" }] },
        { number: 2, players: [{ player: 2, side: "T" }] },
      ]),
    ).toEqual([]);
    expect(
      economyBreakAfter([
        { number: 1, players: [] },
        { number: 2, players: [{ player: 1, side: "T" }] },
      ]),
    ).toEqual([]);
    expect(
      economyBreakAfter([
        { number: 1, players: [{ player: 1, side: "CT" }] },
        { number: 2, players: [{ player: 1, side: "T" }] },
      ]),
    ).toEqual([1]);
  });

  it("draws a smooth line through the points without overshooting a peak", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 0 },
    ];
    const path = smoothLinePath(points);
    expect(path.startsWith("M 0.00 0.00")).toBe(true);
    expect(path.endsWith("20.00 0.00")).toBe(true);
    for (const segment of smoothLineSegments(points)) {
      const low = Math.min(segment.from.y, segment.to.y);
      const high = Math.max(segment.from.y, segment.to.y);
      expect(segment.c1.y).toBeGreaterThanOrEqual(low - 0.01);
      expect(segment.c1.y).toBeLessThanOrEqual(high + 0.01);
      expect(segment.c2.y).toBeGreaterThanOrEqual(low - 0.01);
      expect(segment.c2.y).toBeLessThanOrEqual(high + 0.01);
    }
    expect(TIMELINE_LAYOUT.width).toBeGreaterThan(plot.width);
  });
});

function blocks(...parts: readonly (readonly [Side, number])[]): TimelineRoundRoster[] {
  const rounds: TimelineRoundRoster[] = [];
  let number = 1;
  for (const [side, count] of parts) {
    for (let i = 0; i < count; i++) {
      rounds.push({ number, players: [{ player: 0, side }] });
      number += 1;
    }
  }
  return rounds;
}
