import { describe, expect, it } from "vitest";
import { simplifyStroke, spacePoints } from "./strokes";

describe("spacePoints", () => {
  it("keeps endpoints and drops stacked samples", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 100, y: 0 },
    ];
    const out = spacePoints(pts, 10);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 100, y: 0 });
    expect(out.length).toBe(2);
  });
});

describe("simplifyStroke", () => {
  it("leaves short strokes alone", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(simplifyStroke(pts)).toEqual(pts);
  });

  it("keeps a small letter-sized loop", () => {
    const pts = Array.from({ length: 13 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { x: 20 + Math.cos(a) * 12, y: 20 + Math.sin(a) * 12 };
    });
    const out = simplifyStroke(pts);
    expect(out.length).toBeGreaterThan(8);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1]);
  });

  it("keeps a real corner", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 80, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 40 },
      { x: 120, y: 80 },
      { x: 120, y: 120 },
    ];
    const out = simplifyStroke(pts);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 120, y: 120 });
    expect(out.length).toBe(pts.length);
    const nearCorner = out.some((p) => p.x >= 90 && p.y <= 30);
    expect(nearCorner).toBe(true);
  });
});
