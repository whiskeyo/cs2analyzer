import { describe, expect, it } from "vitest";
import {
  RATING_CENTER,
  RATING_FLOOR,
  RATING_GRAPH_MAX,
  RATING_SPREAD_STD,
} from "@/lib/shared/constants";
import { MATCH_RATING_RANGES } from "./rating";
import {
  ratingBandPath,
  ratingCurvePath,
  ratingGraphDomain,
  ratingGraphTicks,
  ratingNormalPdf,
  ratingRangeBounds,
  ratingToX,
  sampleRatingAxis,
} from "./ratingGraph";

describe("ratingNormalPdf", () => {
  it("peaks at the scale center and falls off by one designed std", () => {
    const peak = ratingNormalPdf(RATING_CENTER);
    expect(ratingNormalPdf(RATING_CENTER - 0.01)).toBeLessThan(peak);
    expect(ratingNormalPdf(RATING_CENTER + 0.01)).toBeLessThan(peak);
    expect(ratingNormalPdf(RATING_CENTER + RATING_SPREAD_STD)).toBeLessThan(peak);
  });
});

describe("rating graph geometry", () => {
  it("clips the outstanding tail to the graph max", () => {
    const last = MATCH_RATING_RANGES.at(-1);
    expect(last).toBeTruthy();
    expect(ratingRangeBounds(last!).max).toBe(RATING_GRAPH_MAX);
    expect(ratingGraphDomain()).toEqual({ min: RATING_FLOOR, max: RATING_GRAPH_MAX });
  });

  it("builds a curve and a filled band for every range", () => {
    const xs = sampleRatingAxis(64);
    expect(xs[0]).toBe(RATING_FLOOR);
    expect(xs.at(-1)).toBe(RATING_GRAPH_MAX);
    expect(ratingCurvePath(xs).startsWith("M")).toBe(true);
    for (const range of MATCH_RATING_RANGES) {
      const d = ratingBandPath(range, xs);
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
    }
  });

  it("places the expected rating between the floor and the graph max", () => {
    const x0 = ratingToX(RATING_FLOOR);
    const xCenter = ratingToX(RATING_CENTER);
    const xMax = ratingToX(RATING_GRAPH_MAX);
    expect(xCenter).toBeGreaterThan(x0);
    expect(xCenter).toBeLessThan(xMax);
    expect(ratingGraphTicks()).toContain(RATING_CENTER);
  });
});
