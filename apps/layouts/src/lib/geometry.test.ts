import { describe, expect, it } from "vitest";
import {
  circleRadius,
  distanceToSegment,
  draftPreviewPoints,
  draftToRegion,
  nearestPolygonEdge,
  pointInPolygon,
  polygonArea,
  rectPolygon,
  shapeIsLargeEnough,
  splitPolygonEdge,
  translatePolygon,
} from "./geometry";
import { SQUARE } from "@/lib/testing/callouts";

describe("pointInPolygon", () => {
  it("treats the interior as inside and a far point as outside", () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true);
    expect(pointInPolygon(20, 5, SQUARE)).toBe(false);
  });
});

describe("polygonArea", () => {
  it("returns the absolute area of a rectangle", () => {
    expect(polygonArea(SQUARE)).toBe(100);
  });
});

describe("rectPolygon", () => {
  it("builds an axis-aligned rectangle from two corners", () => {
    expect(rectPolygon({ x: 10, y: 2 }, { x: 0, y: 8 })).toEqual([
      { x: 0, y: 2 },
      { x: 10, y: 2 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ]);
  });
});

describe("draftToRegion", () => {
  it("stores a circle as center plus radius, not a tessellated polygon", () => {
    const region = draftToRegion({
      kind: "circle",
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    });
    expect(region).toEqual({ kind: "circle", x: 0, y: 0, radius: 10 });
    expect(circleRadius({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });

  it("rejects a tiny rect or circle and a short polygon", () => {
    expect(draftToRegion({ kind: "rect", start: { x: 0, y: 0 }, end: { x: 2, y: 2 } })).toBeNull();
    expect(
      draftToRegion({ kind: "circle", start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }),
    ).toBeNull();
    expect(draftToRegion({ kind: "polygon", points: [{ x: 0, y: 0 }] })).toBeNull();
    expect(shapeIsLargeEnough({ kind: "rect", start: { x: 0, y: 0 }, end: { x: 20, y: 20 } })).toBe(
      true,
    );
  });

  it("closes a polygon and a rect", () => {
    expect(draftToRegion({ kind: "polygon", points: SQUARE })).toEqual({
      kind: "polygon",
      points: SQUARE,
    });
    expect(draftToRegion({ kind: "rect", start: { x: 0, y: 0 }, end: { x: 10, y: 8 } })).toEqual({
      kind: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
    });
  });
});

describe("distanceToSegment", () => {
  it("falls back to point distance when the segment is degenerate", () => {
    expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe("draftPreviewPoints", () => {
  it("appends the cursor for a polygon and ignores it for a circle", () => {
    expect(draftPreviewPoints({ kind: "polygon", points: [{ x: 0, y: 0 }] })).toEqual([
      { x: 0, y: 0 },
    ]);
    expect(
      draftPreviewPoints({ kind: "polygon", points: [{ x: 0, y: 0 }] }, { x: 4, y: 4 }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
    ]);
    expect(
      draftPreviewPoints({ kind: "rect", start: { x: 0, y: 0 }, end: { x: 4, y: 4 } }),
    ).toHaveLength(4);
    expect(
      draftPreviewPoints({ kind: "circle", start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }),
    ).toEqual([]);
  });
});

describe("translatePolygon", () => {
  it("shifts every vertex", () => {
    expect(translatePolygon([{ x: 1, y: 2 }], 3, -1)).toEqual([{ x: 4, y: 1 }]);
  });
});

describe("splitPolygonEdge", () => {
  it("inserts a midpoint on the chosen edge including the closing edge", () => {
    expect(splitPolygonEdge(SQUARE, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(splitPolygonEdge(SQUARE, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ]);
    expect(splitPolygonEdge([{ x: 1, y: 1 }], 0)).toEqual([{ x: 1, y: 1 }]);
    expect(splitPolygonEdge([], 0)).toEqual([]);
  });
});

describe("nearestPolygonEdge", () => {
  it("picks the closest screen-space edge", () => {
    const hit = nearestPolygonEdge(SQUARE, (p) => p, 5, -1);
    expect(hit?.index).toBe(0);
    expect(hit?.dist).toBe(1);
    expect(nearestPolygonEdge([{ x: 0, y: 0 }], (p) => p, 0, 0)).toBeNull();
  });
});
