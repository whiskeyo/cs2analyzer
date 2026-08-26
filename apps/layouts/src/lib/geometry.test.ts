import { describe, expect, it } from "vitest";
import {
  circlePolygon,
  nearestPolygonEdge,
  pointInPolygon,
  polygonArea,
  rectPolygon,
  splitPolygonEdge,
} from "./geometry";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("pointInPolygon", () => {
  it("treats the interior as inside and a far point as outside", () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(20, 5, square)).toBe(false);
  });
});

describe("polygonArea", () => {
  it("returns the absolute area of a rectangle", () => {
    expect(polygonArea(square)).toBe(100);
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

describe("circlePolygon", () => {
  it("starts on the radius toward the edge point", () => {
    const pts = circlePolygon({ x: 0, y: 0 }, { x: 10, y: 0 }, 4);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 10, y: 0 });
    expect(pointInPolygon(0, 0, pts)).toBe(true);
    expect(pointInPolygon(20, 0, pts)).toBe(false);
  });
});

describe("splitPolygonEdge", () => {
  it("inserts a midpoint on the chosen edge including the closing edge", () => {
    expect(splitPolygonEdge(square, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(splitPolygonEdge(square, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ]);
  });
});

describe("nearestPolygonEdge", () => {
  it("picks the closest screen-space edge", () => {
    const hit = nearestPolygonEdge(square, (p) => p, 5, -1);
    expect(hit?.index).toBe(0);
    expect(hit?.dist).toBe(1);
  });
});
