import { describe, expect, it } from "vitest";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { drawSmoothLine, simplifyStroke, spacePoints } from "./strokes";

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

describe("drawSmoothLine", () => {
  it("no-ops on an empty path", () => {
    const ctx = createMockCanvas();
    drawSmoothLine(ctx, []);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("strokes a single point", () => {
    const ctx = createMockCanvas();
    drawSmoothLine(ctx, [{ x: 5, y: 10 }]);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(5, 10);
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("draws a straight segment for two points", () => {
    const ctx = createMockCanvas();
    drawSmoothLine(ctx, [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(20, 0);
    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("uses quadratic midpoints for longer strokes", () => {
    const ctx = createMockCanvas();
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
      { x: 30, y: 10 },
    ];
    drawSmoothLine(ctx, pts);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(10, 0, 15, 5);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(20, 10, 25, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(30, 10);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });
});
