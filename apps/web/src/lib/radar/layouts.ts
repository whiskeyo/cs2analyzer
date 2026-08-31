import { publicUrl } from "@/lib/shared/publicUrl";
import {
  emptyMapLayout,
  LAYOUT_SCHEMA,
  parseMapLayout,
  syncGroupOrder,
} from "@shared/layout/schema.ts";
import type { LayoutCallout, LayoutFloor, LayoutPoint, MapLayout } from "@shared/layout/types.ts";
export type { LayoutCallout, LayoutFloor, LayoutPoint, MapLayout };
export { emptyMapLayout, LAYOUT_SCHEMA, parseMapLayout };
import { floorForZ, worldToRadar } from "@/lib/radar/maps";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export function mapKey(mapName: string): string {
  return (
    mapName
      .split("/")
      .pop()
      ?.replace(/_scrimmagemap$/, "") ?? mapName
  );
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

/**
 * Grouped callouts sit together. `groups` is the chip/list order; otherwise first appearance.
 * Ungrouped names keep array order after the grouped blocks.
 */
export function groupLabel(id: string): string {
  const m = /^g(\d+)$/.exec(id);
  return m ? `Group ${m[1]}` : id;
}

export interface LayoutCluster {
  group: string | null;
  callouts: LayoutCallout[];
}

export function clusterLayoutCallouts(layout: MapLayout): LayoutCluster[] {
  const by = new Map<string, LayoutCallout[]>();
  const none: LayoutCallout[] = [];
  for (const callout of layout.callouts) {
    const id = callout.group;
    if (!id) {
      none.push(callout);
      continue;
    }
    let list = by.get(id);
    if (!list) {
      list = [];
      by.set(id, list);
    }
    list.push(callout);
  }
  const order = syncGroupOrder(layout.groups, layout.callouts) ?? [];
  const clustered: LayoutCluster[] = order.map((group) => ({
    group,
    callouts: by.get(group) ?? [],
  }));
  if (none.length > 0) clustered.push({ group: null, callouts: none });
  return clustered;
}

export function orderedLayoutCallouts(layout: MapLayout): LayoutCallout[] {
  return clusterLayoutCallouts(layout).flatMap((cluster) => cluster.callouts);
}

/** Top-level layout groups, in `groups` order (or first appearance). */
export function layoutGroupFilters(
  layout: MapLayout | null | undefined,
): { id: string; label: string }[] {
  if (!layout) return [];
  const out: { id: string; label: string }[] = [];
  for (const cluster of clusterLayoutCallouts(layout)) {
    if (!cluster.group) continue;
    out.push({ id: cluster.group, label: groupLabel(cluster.group) });
  }
  return out;
}
