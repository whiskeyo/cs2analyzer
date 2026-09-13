import { describe, expect, it, vi } from "vitest";
import {
  RADAR_PAPER_BRIGHTNESS,
  RADAR_PAPER_CONTRAST,
  RADAR_PAPER_INVERT,
} from "@/lib/shared/constants";
import {
  MAP_OUTLINE_INK,
  mapLuma,
  mapOutlineImageData,
  mapPixelIsContent,
  paintMapOutline,
  radarMapPaperFilter,
  withRadarMapPaper,
} from "./mapPaper";

function imageData(width: number, height: number, pixels: number[]): ImageData {
  return { width, height, data: new Uint8ClampedArray(pixels), colorSpace: "srgb" } as ImageData;
}

function rgbaAt(data: ImageData, x: number, y: number): number[] {
  const i = (y * data.width + x) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]];
}

describe("radarMapPaperFilter", () => {
  it("inverts and lifts the Valve PNG toward paper-white", () => {
    expect(radarMapPaperFilter()).toBe(
      `invert(${RADAR_PAPER_INVERT}) brightness(${RADAR_PAPER_BRIGHTNESS}) contrast(${RADAR_PAPER_CONTRAST}) saturate(0)`,
    );
  });
});

describe("withRadarMapPaper", () => {
  it("sets the paper filter only for the draw callback", () => {
    const seen: string[] = [];
    const ctx = { filter: "blur(1px)" } as CanvasRenderingContext2D;
    withRadarMapPaper(ctx, () => {
      seen.push(ctx.filter);
    });
    expect(seen).toEqual([radarMapPaperFilter()]);
    expect(ctx.filter).toBe("blur(1px)");
  });
});

describe("mapPixelIsContent", () => {
  it("treats transparent and near-black padding as empty", () => {
    expect(mapPixelIsContent(0, 0, 0, 0)).toBe(false);
    expect(mapPixelIsContent(0, 0, 0, 255)).toBe(false);
    expect(mapPixelIsContent(40, 40, 40, 255)).toBe(true);
    expect(mapLuma(255, 255, 255)).toBeGreaterThan(mapLuma(40, 40, 40));
  });
});

function isInk(data: ImageData, x: number, y: number): boolean {
  return rgbaAt(data, x, y)[3] === MAP_OUTLINE_INK.a;
}

describe("mapOutlineImageData", () => {
  it("traces a 1px silhouette and does not bleed into empty padding", () => {
    // 5×5: empty padding around a 3×3 gray floor.
    const gray = [70, 70, 70, 255];
    const empty = [0, 0, 0, 0];
    const row = (cells: number[][]) => cells.flat();
    const src = imageData(5, 5, [
      ...row([empty, empty, empty, empty, empty]),
      ...row([empty, gray, gray, gray, empty]),
      ...row([empty, gray, gray, gray, empty]),
      ...row([empty, gray, gray, gray, empty]),
      ...row([empty, empty, empty, empty, empty]),
    ]);
    const out = mapOutlineImageData(src);
    const ink = [MAP_OUTLINE_INK.r, MAP_OUTLINE_INK.g, MAP_OUTLINE_INK.b, MAP_OUTLINE_INK.a];
    expect(rgbaAt(out, 1, 1)).toEqual(ink);
    expect(rgbaAt(out, 2, 1)).toEqual(ink);
    expect(rgbaAt(out, 2, 0)).toEqual([0, 0, 0, 0]);
    expect(rgbaAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(isInk(out, 2, 2)).toBe(false);
  });

  it("marks an interior wall as a 1px ridge, not a dilated band", () => {
    const floor = [60, 60, 60, 255];
    const wall = [240, 240, 240, 255];
    const row = [...floor, ...floor, ...floor, ...wall, ...floor, ...floor, ...floor];
    const src = imageData(7, 7, [...row, ...row, ...row, ...row, ...row, ...row, ...row]);
    const out = mapOutlineImageData(src);
    expect(isInk(out, 3, 3)).toBe(true);
    expect(rgbaAt(out, 3, 3)[0]).toBe(MAP_OUTLINE_INK.r);
    expect(isInk(out, 1, 3)).toBe(false);
  });

  it("does not fill a one-pixel corridor between two walls", () => {
    const floor = [60, 60, 60, 255];
    const wall = [240, 240, 240, 255];
    const row = [...floor, ...floor, ...wall, ...floor, ...wall, ...floor, ...floor];
    const src = imageData(7, 5, [...row, ...row, ...row, ...row, ...row]);
    const out = mapOutlineImageData(src);
    expect(isInk(out, 2, 2)).toBe(true);
    expect(isInk(out, 4, 2)).toBe(true);
    expect(isInk(out, 3, 2)).toBe(false);
  });
});

describe("paintMapOutline", () => {
  it("skips when the PNG is not ready", () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    paintMapOutline(ctx, { complete: false, naturalWidth: 0 } as HTMLImageElement, 0, 0, 100);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
