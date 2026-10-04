/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX } from "@/lib/shared/constants";
import {
  aggregatedRoundRowNeededWidth,
  aggregatedRoundRowShouldSplit,
} from "./aggregatedRoundRowSplit";

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
