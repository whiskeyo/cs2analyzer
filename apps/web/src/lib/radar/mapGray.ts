import { DEFAULT_RADAR_GRAY, RADAR_GRAY_MAX, RADAR_GRAY_MIN } from "@/lib/shared/constants";

/** Clamp a stored or live slider value onto 0…1. */
export function clampRadarGray(value: number): number {
  return Math.min(RADAR_GRAY_MAX, Math.max(RADAR_GRAY_MIN, value));
}

/**
 * Canvas `filter` for the map PNG only. 0 = original color, 1 = saturate(0)
 * (HSV-style desaturate, not a hue rotate).
 */
export function radarMapGrayFilter(amount: number = DEFAULT_RADAR_GRAY): string {
  const gray = clampRadarGray(amount);
  if (gray <= RADAR_GRAY_MIN) {
    return "none";
  }
  return `saturate(${1 - gray})`;
}

/** Apply the map filter around `draw`, then restore the previous `ctx.filter`. */
export function withRadarMapGray(
  ctx: CanvasRenderingContext2D,
  amount: number,
  draw: () => void,
): void {
  const previous = ctx.filter;
  ctx.filter = radarMapGrayFilter(amount);
  draw();
  ctx.filter = previous;
}
