import {
  RADAR_PAPER_BRIGHTNESS,
  RADAR_PAPER_CONTRAST,
  RADAR_PAPER_INVERT,
} from "@/lib/shared/constants";

/** Floor / wall pixels vs empty (transparent or near-black) overview padding. */
export const MAP_CONTENT_ALPHA_MIN = 16;
export const MAP_CONTENT_LUMA_MIN = 8;
/** Sobel magnitude that counts as an interior wall on the Valve PNG. */
export const MAP_OUTLINE_SOBEL_MIN = 36;
/** Dark ink so inverted walls still read on a light PDF page. */
export const MAP_OUTLINE_INK = { r: 28, g: 30, b: 34, a: 235 } as const;

const outlineCache = new WeakMap<HTMLImageElement, HTMLCanvasElement | null>();

function makeImageData(width: number, height: number, data?: Uint8ClampedArray): ImageData {
  if (typeof ImageData === "function") {
    const out = new ImageData(width, height);
    if (data) {
      out.data.set(data);
    }
    return out;
  }
  return {
    width,
    height,
    data: data ?? new Uint8ClampedArray(width * height * 4),
    colorSpace: "srgb",
  } as ImageData;
}

export function mapLuma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True for playable-area / wall pixels; false for transparent or black padding. */
export function mapPixelIsContent(r: number, g: number, b: number, a: number): boolean {
  return a >= MAP_CONTENT_ALPHA_MIN && mapLuma(r, g, b) >= MAP_CONTENT_LUMA_MIN;
}

/**
 * Canvas `filter` for the paper layout. Invert flips dark floors to light,
 * then brightness / contrast lift them toward paper-white. Saturate(0) keeps
 * inverted Valve tints from going psychedelic.
 */
export function radarMapPaperFilter(): string {
  return `invert(${RADAR_PAPER_INVERT}) brightness(${RADAR_PAPER_BRIGHTNESS}) contrast(${RADAR_PAPER_CONTRAST}) saturate(0)`;
}

/** Apply the paper filter around `draw`, then restore the previous `ctx.filter`. */
export function withRadarMapPaper(ctx: CanvasRenderingContext2D, draw: () => void): void {
  const previous = ctx.filter;
  ctx.filter = radarMapPaperFilter();
  draw();
  ctx.filter = previous;
}

function sobelAt(
  lumaAt: (x: number, y: number) => number,
  x: number,
  y: number,
): { gx: number; gy: number; mag: number } {
  const gx =
    -lumaAt(x - 1, y - 1) +
    lumaAt(x + 1, y - 1) +
    -2 * lumaAt(x - 1, y) +
    2 * lumaAt(x + 1, y) +
    -lumaAt(x - 1, y + 1) +
    lumaAt(x + 1, y + 1);
  const gy =
    -lumaAt(x - 1, y - 1) -
    2 * lumaAt(x, y - 1) -
    lumaAt(x + 1, y - 1) +
    lumaAt(x - 1, y + 1) +
    2 * lumaAt(x, y + 1) +
    lumaAt(x + 1, y + 1);
  return { gx, gy, mag: Math.hypot(gx, gy) };
}

/**
 * Interior walls (luma Sobel) plus the outer map silhouette. Output is dark
 * ink on a transparent canvas so it can sit on the inverted PNG.
 *
 * Valve walls are anti-aliased, so a raw Sobel band is already 2–3px. A
 * dilate on top of that fills corridors. Keep a 1px ridge on the bright
 * (wall) side of each edge — no dilation.
 */
export function mapOutlineImageData(src: ImageData): ImageData {
  const { width: w, height: h, data } = src;
  const dest = new Uint8ClampedArray(w * h * 4);
  const ink = MAP_OUTLINE_INK;
  const mark = new Uint8Array(w * h);
  const mag = new Float32Array(w * h);
  const gradX = new Float32Array(w * h);
  const gradY = new Float32Array(w * h);

  const lumaAt = (x: number, y: number): number => {
    const i = (y * w + x) * 4;
    return mapLuma(data[i], data[i + 1], data[i + 2]);
  };
  const contentAt = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = (y * w + x) * 4;
    return mapPixelIsContent(data[i], data[i + 1], data[i + 2], data[i + 3]);
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!contentAt(x, y)) continue;
      const edge = sobelAt(lumaAt, x, y);
      if (edge.mag < MAP_OUTLINE_SOBEL_MIN) continue;
      const i = y * w + x;
      mag[i] = edge.mag;
      gradX[i] = edge.gx;
      gradY[i] = edge.gy;
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m <= 0) continue;
      const gx = gradX[i];
      const gy = gradY[i];
      const alongX = Math.abs(gx) >= Math.abs(gy);
      const a = alongX ? mag[i - 1] : mag[i - w];
      const b = alongX ? mag[i + 1] : mag[i + w];
      if (a > m || b > m) continue;
      // Soft AA fires on the floor beside a 1px wall. Snap ink onto the
      // brighter ridge so corridors stay open and the line sits on the wall.
      let inkX = x;
      let inkY = y;
      const brightX = x + Math.sign(gx);
      const brightY = y + Math.sign(gy);
      if (contentAt(brightX, brightY) && lumaAt(brightX, brightY) > lumaAt(x, y)) {
        inkX = brightX;
        inkY = brightY;
      }
      mark[inkY * w + inkX] = 1;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!contentAt(x, y)) continue;
      if (
        !contentAt(x - 1, y) ||
        !contentAt(x + 1, y) ||
        !contentAt(x, y - 1) ||
        !contentAt(x, y + 1)
      ) {
        mark[i] = 1;
      }
    }
  }

  for (let i = 0; i < mark.length; i++) {
    if (!mark[i]) continue;
    const p = i * 4;
    dest[p] = ink.r;
    dest[p + 1] = ink.g;
    dest[p + 2] = ink.b;
    dest[p + 3] = ink.a;
  }
  return makeImageData(w, h, dest);
}

/** Rasterize and cache the outline for one map PNG. Failed reads stay skipped. */
export function mapOutlineCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
  if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return null;
  }
  if (outlineCache.has(img)) {
    return outlineCache.get(img) ?? null;
  }
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scratch = document.createElement("canvas");
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      outlineCache.set(img, null);
      return null;
    }
    ctx.drawImage(img, 0, 0);
    ctx.putImageData(mapOutlineImageData(ctx.getImageData(0, 0, w, h)), 0, 0);
    outlineCache.set(img, scratch);
    return scratch;
  } catch {
    outlineCache.set(img, null);
    return null;
  }
}

/** Blit the cached wall outline over the inverted map, same dest rect. */
export function paintMapOutline(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
): void {
  const outline = mapOutlineCanvas(img);
  if (!outline) return;
  ctx.drawImage(outline, x, y, size, size);
}

/** Tests: drop a cached outline so a fixture image can be reused. */
export function clearMapOutlineCacheForTests(img?: HTMLImageElement): void {
  if (img) {
    outlineCache.delete(img);
    return;
  }
}
