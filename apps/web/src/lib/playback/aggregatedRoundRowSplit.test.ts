/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX } from "@/lib/shared/constants";
import {
  aggregatedRoundRowNeededWidth,
  aggregatedRoundRowShouldSplit,
  aggregatedStripFrame,
  aggregatedStripMaxHeight,
} from "./aggregatedRoundRowSplit";

describe("aggregatedStripMaxHeight", () => {
  it("uses the full-stage strip height as the cap", () => {
    expect(aggregatedStripMaxHeight(140)).toBe(140);
    expect(aggregatedStripMaxHeight(139.5625)).toBe(139.5625);
  });

  it("skips the cap until the full-stage strip has a height", () => {
    expect(aggregatedStripMaxHeight(0)).toBeNull();
    expect(aggregatedStripMaxHeight(Number.NaN)).toBeNull();
  });
});

describe("aggregated round row layout", () => {
  it("does not let a capped strip squeeze a wrapped row onto the next one", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    const block = css.match(/\.series-round-row \{[^}]+\}/);
    expect(block?.[0]).toMatch(/flex:\s*0\s+0\s+auto/);
  });
});

describe("aggregatedStripFrame", () => {
  const pistolEcoForceFull = {
    cap: 139.5625,
    rowTops: [4, 31.2, 84.4, 137.6],
    rowBottoms: [28, 81.2, 134.4, 187.6],
    contentEnd: 191.6,
  };

  it("stops on a row edge instead of through the next row's chips", () => {
    const frame = aggregatedStripFrame(pistolEcoForceFull);
    expect(frame).not.toBeNull();
    if (frame == null) return;
    expect(frame.height).toBe(134.4);
    expect(frame.height).toBeLessThanOrEqual(pistolEcoForceFull.cap);
    expect(frame.scrolls).toBe(true);
    expect(frame.tail).toBeCloseTo(27.2);
    const end = pistolEcoForceFull.contentEnd + frame.tail;
    for (const top of frame.snapOffsets) {
      const bottom = top + frame.height;
      expect(bottom).toBeLessThanOrEqual(end + 0.5);
      for (let index = 0; index < pistolEcoForceFull.rowTops.length; index += 1) {
        const rowTop = pistolEcoForceFull.rowTops[index] ?? 0;
        const rowBottom = pistolEcoForceFull.rowBottoms[index] ?? rowTop;
        const overlaps = rowBottom > top + 0.5 && rowTop < bottom - 0.5;
        if (!overlaps) continue;
        expect(rowTop).toBeGreaterThanOrEqual(top - 0.5);
        expect(rowBottom).toBeLessThanOrEqual(bottom + 0.5);
      }
    }
    expect(frame.snapOffsets.some((top) => Math.abs(top - 84.4) < 0.5)).toBe(true);
  });

  it("does not scroll when every row fits in the cap", () => {
    const frame = aggregatedStripFrame({ ...pistolEcoForceFull, cap: 200 });
    expect(frame).toEqual({ height: 191.6, tail: 0, snapOffsets: [0], scrolls: false });
  });
});

describe("aggregatedRoundRowShouldSplit", () => {
  it("keeps one line when the chips fit", () => {
    expect(aggregatedRoundRowShouldSplit(200, 200, false)).toBe(false);
    expect(aggregatedRoundRowShouldSplit(80, 200, false)).toBe(false);
  });

  it("splits when the unsplit width overflows the track", () => {
    expect(aggregatedRoundRowShouldSplit(201, 200, false)).toBe(true);
  });

  it("stays split until the track has hysteresis slack", () => {
    const needed = 400;
    const almost = needed + AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX - 1;
    const clear = needed + AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX;
    expect(aggregatedRoundRowShouldSplit(needed, almost, true)).toBe(true);
    expect(aggregatedRoundRowShouldSplit(needed, clear, true)).toBe(false);
  });

  it("keeps the current choice when layout width is not ready", () => {
    expect(aggregatedRoundRowShouldSplit(0, 0, false)).toBe(false);
    expect(aggregatedRoundRowShouldSplit(0, 0, true)).toBe(true);
  });
});

describe("aggregatedRoundRowNeededWidth", () => {
  it("reads the measure element's scroll width", () => {
    const measure = document.createElement("div");
    Object.defineProperty(measure, "scrollWidth", { configurable: true, value: 480 });
    expect(aggregatedRoundRowNeededWidth(measure)).toBe(480);
  });

  it("uses nowrap children when they are wider than the clamped element", () => {
    const measure = document.createElement("div");
    const first = document.createElement("span");
    const second = document.createElement("span");
    Object.defineProperty(first, "offsetWidth", { configurable: true, value: 300 });
    Object.defineProperty(second, "offsetWidth", { configurable: true, value: 220 });
    measure.append(first, second);
    Object.defineProperty(measure, "scrollWidth", { configurable: true, value: 100 });
    expect(aggregatedRoundRowNeededWidth(measure)).toBe(520);
  });
});
