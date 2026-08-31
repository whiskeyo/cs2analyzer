import { publicUrl } from "@/lib/shared/publicUrl";
import { radarLayout, screenToRadar, type RadarView } from "@shared/radar/viewport.ts";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import type { FloorMode } from "@/lib/notes/types";

export type { RadarView };
export { radarLayout, screenToRadar };

let cache: Record<string, MapCalibration> | null = null;

export async function loadCalibrations(): Promise<Record<string, MapCalibration>> {
  if (cache) return cache;
  const res = await fetch(publicUrl("maps/calibrations.json"));
  cache = (await res.json()) as Record<string, MapCalibration>;
  return cache;
}

export function radarUrl(file: string): string {
  return publicUrl(`maps/${file}`);
}

export function calibrationFor(
  maps: Record<string, MapCalibration>,
  mapName: string,
): MapCalibration | undefined {
  const name =
    mapName
      .split("/")
      .pop()
      ?.replace(/_scrimmagemap$/, "") ?? mapName;
  return maps[name];
}

export function worldToRadar(c: MapCalibration, x: number, y: number): { x: number; y: number } {
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

/** Which radar image to draw. Explicit Upper/Lower wins; Auto follows selected, then majority alive. */
export function radarFloor(
  c: MapCalibration | undefined,
  players: { index: number; z: number; present: boolean; alive: boolean }[],
  selected: number | null,
  mode: FloorMode = "auto",
): "default" | "lower" {
  if (!c?.lower_radar) return "default";
  if (mode === "upper") return "default";
  if (mode === "lower") return "lower";
  if (selected != null) {
    const focus = players.find((p) => p.index === selected && p.present);
    if (focus) return floorForZ(c, focus.z);
  }
  const alive = players.filter((p) => p.present && p.alive);
  if (alive.length === 0) return "default";
  const lowerVotes = alive.filter((p) => floorForZ(c, p.z) === "lower").length;
  return lowerVotes > alive.length / 2 ? "lower" : "default";
}

export function radarToWorld(c: MapCalibration, px: number, py: number): { x: number; y: number } {
  return {
    x: px * c.scale + c.pos_x,
    y: c.pos_y - py * c.scale,
  };
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
    return {
      x: w / 2 + wx * 0.05 * view.scale,
      y: h / 2 - wy * 0.05 * view.scale,
    };
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
