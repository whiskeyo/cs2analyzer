import { publicUrl } from "@/lib/shared/publicUrl";
import { floorForZ, worldToRadar } from "@/lib/radar/maps";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export const LAYOUT_SCHEMA = 1;
const MIN_POLYGON_VERTICES = 3;

export type LayoutFloor = "default" | "lower";

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutCallout {
  id: string;
  name: string;
  floor: LayoutFloor;
  /** Radar pixels on the 1024 Valve overview. */
  polygon: LayoutPoint[];
}

export interface MapLayout {
  schema: 1;
  map: string;
  callouts: LayoutCallout[];
}

export function emptyMapLayout(map: string): MapLayout {
  return { schema: LAYOUT_SCHEMA, map, callouts: [] };
}

export function mapKey(mapName: string): string {
  return (
    mapName
      .split("/")
      .pop()
      ?.replace(/_scrimmagemap$/, "") ?? mapName
  );
}

function isPoint(value: unknown): value is LayoutPoint {
  if (typeof value !== "object" || value == null) return false;
  const p = value as { x?: unknown; y?: unknown };
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isFloor(value: unknown): value is LayoutFloor {
  return value === "default" || value === "lower";
}

function parseCallout(value: unknown): LayoutCallout | null {
  if (typeof value !== "object" || value == null) return null;
  const row = value as {
    id?: unknown;
    name?: unknown;
    floor?: unknown;
    polygon?: unknown;
  };
  if (typeof row.id !== "string" || row.id.length === 0) return null;
  if (typeof row.name !== "string" || row.name.length === 0) return null;
  if (!isFloor(row.floor)) return null;
  if (!Array.isArray(row.polygon) || row.polygon.length < MIN_POLYGON_VERTICES) return null;
  const polygon: LayoutPoint[] = [];
  for (const p of row.polygon) {
    if (!isPoint(p)) return null;
    polygon.push({ x: p.x, y: p.y });
  }
  return { id: row.id, name: row.name, floor: row.floor, polygon };
}

export function parseMapLayout(data: unknown, expectedMap?: string): MapLayout | null {
  if (typeof data !== "object" || data == null) return null;
  const row = data as { schema?: unknown; map?: unknown; callouts?: unknown };
  if (row.schema !== LAYOUT_SCHEMA) return null;
  if (typeof row.map !== "string" || row.map.length === 0) return null;
  if (expectedMap && row.map !== expectedMap) return null;
  if (!Array.isArray(row.callouts)) return null;
  const seen = new Set<string>();
  const callouts: LayoutCallout[] = [];
  for (const item of row.callouts) {
    const callout = parseCallout(item);
    if (!callout || seen.has(callout.id)) continue;
    seen.add(callout.id);
    callouts.push(callout);
  }
  return { schema: LAYOUT_SCHEMA, map: row.map, callouts };
}

function pointInPolygon(x: number, y: number, polygon: LayoutPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const intersect =
      a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(polygon: LayoutPoint[]): LayoutPoint {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p.x;
    y += p.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 0 if the point is inside; otherwise the shortest radar-pixel distance to an edge. */
export function distanceToPolygon(x: number, y: number, polygon: LayoutPoint[]): number {
  if (polygon.length === 0) return Number.POSITIVE_INFINITY;
  if (pointInPolygon(x, y, polygon)) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    best = Math.min(best, distanceToSegment(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

function polygonArea(polygon: LayoutPoint[]): number {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    area += b.x * a.y - a.x * b.y;
  }
  return Math.abs(area) / 2;
}

/** Smallest covering polygon on that floor wins when regions overlap. */
export function calloutAtRadar(
  layout: MapLayout,
  radarX: number,
  radarY: number,
  floor: LayoutFloor = "default",
): LayoutCallout | null {
  const hits = layout.callouts.filter(
    (c) => c.floor === floor && pointInPolygon(radarX, radarY, c.polygon),
  );
  if (hits.length === 0) return null;
  hits.sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon));
  return hits[0] ?? null;
}

export function calloutAtWorld(
  layout: MapLayout,
  cal: MapCalibration,
  wx: number,
  wy: number,
  z?: number,
): LayoutCallout | null {
  const radar = worldToRadar(cal, wx, wy);
  const floor = z == null ? "default" : floorForZ(cal, z);
  return calloutAtRadar(layout, radar.x, radar.y, floor);
}

const cache = new Map<string, MapLayout>();

export async function loadMapLayout(mapName: string): Promise<MapLayout> {
  const map = mapKey(mapName);
  const hit = cache.get(map);
  if (hit) return hit;
  const res = await fetch(publicUrl(`layouts/${map}.json`));
  if (res.status === 404) {
    const empty = emptyMapLayout(map);
    cache.set(map, empty);
    return empty;
  }
  if (!res.ok) throw new Error(`could not load layout for ${map}`);
  const parsed = parseMapLayout(await res.json(), map) ?? emptyMapLayout(map);
  cache.set(map, parsed);
  return parsed;
}
