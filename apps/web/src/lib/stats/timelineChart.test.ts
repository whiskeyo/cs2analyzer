import { describe, expect, it } from "vitest";
import {
  axisScale,
  economyBreakAfter,
  nearestRoundIndex,
  percentAxis,
  plotRect,
  roundX,
  smoothLinePath,
  smoothLineSegments,
  ROUND_LABEL_SLOT_PX,
  TIMELINE_LAYOUT,
  roundLabelOrientation,
  valueToY,
  type TimelineRoundRoster,
} from "./timelineChart";
import type { Side } from "@/lib/replay/replayTypes";

describe("timelineChart", () => {
  const plot = plotRect();

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
