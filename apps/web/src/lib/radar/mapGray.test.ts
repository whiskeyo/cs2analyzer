import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RADAR_GRAY, RADAR_GRAY_MIN } from "@/lib/shared/constants";
import { clampRadarGray, radarMapGrayFilter, withRadarMapGray } from "./mapGray";

describe("radarMapGrayFilter", () => {
  it("desaturates fully at the shipped default", () => {
    expect(radarMapGrayFilter()).toBe("saturate(0)");
    expect(radarMapGrayFilter(DEFAULT_RADAR_GRAY)).toBe("saturate(0)");
  });

  it("leaves the original PNG when amount is 0", () => {
    expect(radarMapGrayFilter(RADAR_GRAY_MIN)).toBe("none");
  });

  it("scales saturation for in-between amounts", () => {
    expect(radarMapGrayFilter(0.25)).toBe("saturate(0.75)");
    expect(radarMapGrayFilter(0.5)).toBe("saturate(0.5)");
  });

  it("clamps out-of-range amounts", () => {
    expect(clampRadarGray(-1)).toBe(0);
    expect(clampRadarGray(4)).toBe(1);
    expect(radarMapGrayFilter(-1)).toBe("none");
    expect(radarMapGrayFilter(4)).toBe("saturate(0)");
  });
});

describe("withRadarMapGray", () => {
  it("sets the filter only for the draw callback", () => {
    const seen: string[] = [];
    const ctx = {
      filter: "blur(1px)",
    } as CanvasRenderingContext2D;
    withRadarMapGray(ctx, 1, () => {
      seen.push(ctx.filter);
    });
    expect(seen).toEqual(["saturate(0)"]);
    expect(ctx.filter).toBe("blur(1px)");
  });

  it("skips a canvas filter when the map stays in color", () => {
    const draw = vi.fn();
    const ctx = { filter: "none" } as CanvasRenderingContext2D;
    withRadarMapGray(ctx, 0, draw);
    expect(draw).toHaveBeenCalledOnce();
    expect(ctx.filter).toBe("none");
  });
});
