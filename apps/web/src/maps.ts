import type { MapCalibration } from "./types";

let cache: Record<string, MapCalibration> | null = null;

export async function loadCalibrations(): Promise<Record<string, MapCalibration>> {
  if (cache) return cache;
  const res = await fetch("/maps/calibrations.json");
  cache = (await res.json()) as Record<string, MapCalibration>;
  return cache;
}

export function radarUrl(file: string): string {
  return `/maps/${file}`;
}

export function calibrationFor(
  maps: Record<string, MapCalibration>,
  mapName: string,
): MapCalibration | undefined {
  const name = mapName.split("/").pop()?.replace(/_scrimmagemap$/, "") ?? mapName;
  return maps[name];
}

export function worldToRadar(
  c: MapCalibration,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: (x - c.pos_x) / c.scale,
    y: (c.pos_y - y) / c.scale,
  };
}

export function floorForZ(c: MapCalibration, z: number): "default" | "lower" {
  if (!c.floors || c.floors.length === 0) return "default";
  for (const f of c.floors) {
    if (z >= f.z_min && z < f.z_max) {
      return f.name === "lower" ? "lower" : "default";
    }
  }
  return "default";
}

export function radarToWorld(
  c: MapCalibration,
  px: number,
  py: number,
): { x: number; y: number } {
  return {
    x: px * c.scale + c.pos_x,
    y: c.pos_y - py * c.scale,
  };
}

export interface RadarView {
  scale: number;
  ox: number;
  oy: number;
}

export function radarLayout(w: number, h: number, view: RadarView) {
  const pad = 16;
  const fit = Math.min(w, h) - pad * 2;
  const baseX = (w - fit) / 2 + view.ox;
  const baseY = (h - fit) / 2 + view.oy;
  return { pad, fit, baseX, baseY, imgSize: 1024 };
}

export function worldToScreen(
  cal: MapCalibration | undefined,
  w: number,
  h: number,
  view: RadarView,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const { fit, baseX, baseY, imgSize } = radarLayout(w, h, view);
  if (!cal) {
    return { x: w / 2 + wx * 0.05 * view.scale, y: h / 2 - wy * 0.05 * view.scale };
  }
  const r = worldToRadar(cal, wx, wy);
  return {
    x: baseX + (r.x / imgSize) * fit * view.scale,
    y: baseY + (r.y / imgSize) * fit * view.scale,
  };
}

export function screenToWorld(
  cal: MapCalibration,
  w: number,
  h: number,
  view: RadarView,
  sx: number,
  sy: number,
): { x: number; y: number } {
  const { fit, baseX, baseY, imgSize } = radarLayout(w, h, view);
  const rx = ((sx - baseX) / (fit * view.scale)) * imgSize;
  const ry = ((sy - baseY) / (fit * view.scale)) * imgSize;
  return radarToWorld(cal, rx, ry);
}
