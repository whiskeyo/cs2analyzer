import { describe, expect, it } from "vitest";
import {
  axisScale,
  bandRect,
  nearestRoundIndex,
  percentAxis,
  pillTextColor,
  playerColor,
  plotRect,
  roundMarkerSize,
  roundX,
  showBandLabel,
  sideBands,
  smoothLinePath,
  smoothLineSegments,
  spreadLabels,
  TIMELINE_LAYOUT,
  valueToY,
} from "./timelineChart";

describe("timelineChart", () => {
  const plot = plotRect();

  it("gives each of the first players a distinct tint", () => {
    const colors = [0, 1, 2, 3, 4].map(playerColor);
    expect(new Set(colors).size).toBe(5);
    expect(pillTextColor("#ffe83a")).toBe("#1a1206");
    expect(pillTextColor("#d62728")).toBe("#fff");
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

  it("maps values with zero on the baseline and the max on the top", () => {
    expect(valueToY(0, 100, plot)).toBeCloseTo(plot.y + plot.height);
    expect(valueToY(100, 100, plot)).toBeCloseTo(plot.y);
    expect(roundX(0, 2, plot)).toBeLessThan(roundX(1, 2, plot));
    expect(nearestRoundIndex(roundX(1, 4, plot), 4, plot)).toBe(1);
  });

  it("splits side bands only when the selected team switches", () => {
    const bands = sideBands(["T", "T", "T", "CT", "CT"]);
    expect(bands).toEqual([
      { side: "T", start: 0, end: 3 },
      { side: "CT", start: 3, end: 5 },
    ]);
    const first = bandRect(bands[0]!, 5, plot);
    const second = bandRect(bands[1]!, 5, plot);
    expect(first.x).toBeCloseTo(plot.x);
    expect(first.x + first.width).toBeCloseTo(second.x);
    expect(second.x + second.width).toBeCloseTo(plot.x + plot.width);
    expect(showBandLabel(first.width)).toBe(true);
    expect(showBandLabel(20)).toBe(false);
  });

  it("shrinks round markers once the axis gets crowded", () => {
    expect(roundMarkerSize(24).radius).toBeGreaterThan(roundMarkerSize(36).radius);
  });

  it("separates overlapping name pills and keeps them inside the plot", () => {
    const spread = spreadLabels([10, 12, 11], 0, 100, 18);
    const ordered = [...spread].sort((a, b) => a - b);
    expect(ordered[1]! - ordered[0]!).toBeGreaterThanOrEqual(18);
    expect(ordered[2]! - ordered[1]!).toBeGreaterThanOrEqual(18);
    const packed = spreadLabels([0, 0, 0, 0], 0, 30, 20);
    expect(Math.min(...packed)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...packed)).toBeLessThanOrEqual(30);
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
