import { RADAR_FIT_PAD, RADAR_OVERVIEW_SIZE } from "./constants";
import type { MapCalibration, Point } from "./types";

export interface RadarView {
  scale: number;
  ox: number;
  oy: number;
}

export function radarLayout(w: number, h: number, view: RadarView) {
  const fit = Math.min(w, h) - RADAR_FIT_PAD * 2;
  const baseX = (w - fit) / 2 + view.ox;
  const baseY = (h - fit) / 2 + view.oy;
  return { fit, baseX, baseY, imgSize: RADAR_OVERVIEW_SIZE };
}

export function screenToRadar(
  w: number,
  h: number,
  view: RadarView,
  sx: number,
  sy: number,
): Point {
  const { fit, baseX, baseY, imgSize } = radarLayout(w, h, view);
  const span = fit * view.scale || 1;
  return {
    x: ((sx - baseX) / span) * imgSize,
    y: ((sy - baseY) / span) * imgSize,
  };
}

export function radarToScreen(
  w: number,
  h: number,
  view: RadarView,
  rx: number,
  ry: number,
): Point {
  const { fit, baseX, baseY, imgSize } = radarLayout(w, h, view);
  return {
    x: baseX + (rx / imgSize) * fit * view.scale,
    y: baseY + (ry / imgSize) * fit * view.scale,
  };
}

export async function loadCalibrations(): Promise<Record<string, MapCalibration>> {
  const res = await fetch("/maps/calibrations.json");
  if (!res.ok) throw new Error("could not load map calibrations");
  return (await res.json()) as Record<string, MapCalibration>;
}

export function radarFile(cal: MapCalibration, floor: "default" | "lower"): string {
  if (floor === "lower") return cal.lower_radar ?? cal.radar;
  return cal.radar;
}
