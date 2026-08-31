import { describe, expect, it } from "vitest";
import type { DemoSeries } from "./session";
import {
  isAggregatedView,
  isBucketOverlayActive,
  isMultiDemoSeries,
  showSeriesBar,
} from "./seriesMode";

function series(demoCount: number): DemoSeries {
  const demos = Array.from({ length: demoCount }, (_, i) => ({
    id: `d${i}`,
    fileName: `m${i}.dem`,
    replay: {} as DemoSeries["demos"][0]["replay"],
    file: {} as DemoSeries["demos"][0]["file"],
  }));
  return {
    mapName: "de_mirage",
    demos,
    focalTeam: "Team A",
    focalTeamNames: ["Team A"],
    tagsByDemo: new Map(),
  };
}

describe("isMultiDemoSeries", () => {
  it("is false without a series", () => {
    expect(isMultiDemoSeries(null)).toBe(false);
    expect(isMultiDemoSeries(undefined)).toBe(false);
  });

  it("is false for a single demo", () => {
    expect(isMultiDemoSeries(series(1))).toBe(false);
  });

  it("is true for two or more demos", () => {
    expect(isMultiDemoSeries(series(2))).toBe(true);
  });
});

describe("showSeriesBar", () => {
  it("is false without a series", () => {
    expect(showSeriesBar({ series: null, mapGroups: [] })).toBe(false);
  });

  it("is true for multi-demo on one map", () => {
    expect(showSeriesBar({ series: series(2), mapGroups: [] })).toBe(true);
  });

  it("is true for single-demo multi-map drop", () => {
    expect(
      showSeriesBar({
        series: series(1),
        mapGroups: [
          { mapName: "de_mirage", demos: [] },
          { mapName: "de_inferno", demos: [] },
        ],
      }),
    ).toBe(true);
  });
});

describe("isAggregatedView", () => {
  it("requires multi-demo and aggregated flag", () => {
    expect(isAggregatedView(series(2), { aggregated: true })).toBe(true);
    expect(isAggregatedView(series(2), { aggregated: false })).toBe(false);
    expect(isAggregatedView(series(1), { aggregated: true })).toBe(false);
  });
});

describe("isBucketOverlayActive", () => {
  it("requires aggregated bucket selection and overlay on", () => {
    const habits = {
      aggregated: true,
      overlayOn: true,
      bucketOverlay: { kind: "full" as const, side: "CT" as const },
    };
    expect(isBucketOverlayActive(series(2), habits)).toBe(true);
    expect(isBucketOverlayActive(series(1), habits)).toBe(false);
    expect(isBucketOverlayActive(series(2), { ...habits, overlayOn: false })).toBe(false);
    expect(isBucketOverlayActive(series(2), { ...habits, bucketOverlay: null })).toBe(false);
  });
});
