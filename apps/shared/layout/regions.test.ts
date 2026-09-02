import { describe, expect, it } from "vitest";
import {
  calloutArea,
  calloutCentroid,
  distanceToCallout,
  pointInCallout,
  pointInRegion,
  polygonCallout,
  regionArea,
  translateCallout,
} from "./regions.ts";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("regions", () => {
  it("treats a circle as a disk and a polygon as a filled shape", () => {
    const circle = { kind: "circle" as const, x: 0, y: 0, radius: 5 };
    expect(pointInRegion(0, 0, circle)).toBe(true);
    expect(pointInRegion(6, 0, circle)).toBe(false);
    expect(regionArea(circle)).toBeCloseTo(Math.PI * 25);
    expect(pointInRegion(5, 5, { kind: "polygon", points: square })).toBe(true);
  });

  it("unions disconnected regions on one callout", () => {
    const callout = {
      id: "apps",
      name: "Apps",
      floor: "default" as const,
      regions: [
        { kind: "polygon" as const, points: square },
        { kind: "circle" as const, x: 80, y: 80, radius: 5 },
      ],
    };
    expect(pointInCallout(5, 5, callout)).toBe(true);
    expect(pointInCallout(80, 80, callout)).toBe(true);
    expect(pointInCallout(40, 40, callout)).toBe(false);
    expect(calloutArea(callout)).toBeGreaterThan(100);
    expect(calloutCentroid(callout)).toEqual({ x: 5, y: 5 });
    expect(distanceToCallout(80, 90, callout)).toBe(5);
    const moved = translateCallout(callout, 1, 2);
    expect(moved.regions[1]).toMatchObject({ x: 81, y: 82 });
    expect(polygonCallout("a", "A", square).regions[0]).toMatchObject({ kind: "polygon" });
  });
});
