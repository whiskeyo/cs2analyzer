import type { LayoutCallout, LayoutPoint, LayoutRegion } from "./types.ts";

export const MIN_POLYGON_VERTICES = 3;

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

export function pointInPolygon(x: number, y: number, polygon: LayoutPoint[]): boolean {
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

export function polygonArea(polygon: LayoutPoint[]): number {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    area += b.x * a.y - a.x * b.y;
  }
  return Math.abs(area) / 2;
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

export function pointInRegion(x: number, y: number, region: LayoutRegion): boolean {
  if (region.kind === "circle") {
    return Math.hypot(x - region.x, y - region.y) <= region.radius;
  }
  return pointInPolygon(x, y, region.points);
}

export function regionArea(region: LayoutRegion): number {
  if (region.kind === "circle") return Math.PI * region.radius * region.radius;
  return polygonArea(region.points);
}

export function regionCentroid(region: LayoutRegion): LayoutPoint {
  if (region.kind === "circle") return { x: region.x, y: region.y };
  return polygonCentroid(region.points);
}

export function translateRegion(region: LayoutRegion, dx: number, dy: number): LayoutRegion {
  if (region.kind === "circle") {
    return { kind: "circle", x: region.x + dx, y: region.y + dy, radius: region.radius };
  }
  return {
    kind: "polygon",
    points: region.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

export function distanceToRegion(x: number, y: number, region: LayoutRegion): number {
  if (region.kind === "circle") {
    return Math.max(0, Math.hypot(x - region.x, y - region.y) - region.radius);
  }
  if (region.points.length === 0) return Number.POSITIVE_INFINITY;
  if (pointInPolygon(x, y, region.points)) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = region.points.length - 1; i < region.points.length; j = i++) {
    const a = region.points[i];
    const b = region.points[j];
    if (!a || !b) continue;
    best = Math.min(best, distanceToSegment(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

export function pointInCallout(x: number, y: number, callout: LayoutCallout): boolean {
  return callout.regions.some((region) => pointInRegion(x, y, region));
}

export function calloutArea(callout: LayoutCallout): number {
  return callout.regions.reduce((sum, region) => sum + regionArea(region), 0);
}

/** Label anchor: centroid of the largest region. */
export function calloutCentroid(callout: LayoutCallout): LayoutPoint {
  let best: LayoutRegion | undefined;
  let bestArea = -1;
  for (const region of callout.regions) {
    const area = regionArea(region);
    if (area > bestArea) {
      best = region;
      bestArea = area;
    }
  }
  return best ? regionCentroid(best) : { x: 0, y: 0 };
}

export function distanceToCallout(x: number, y: number, callout: LayoutCallout): number {
  let best = Number.POSITIVE_INFINITY;
  for (const region of callout.regions) {
    best = Math.min(best, distanceToRegion(x, y, region));
  }
  return best;
}

export function translateCallout(callout: LayoutCallout, dx: number, dy: number): LayoutCallout {
  return { ...callout, regions: callout.regions.map((region) => translateRegion(region, dx, dy)) };
}

export function polygonCallout(
  id: string,
  name: string,
  points: LayoutPoint[],
  extra: Partial<Pick<LayoutCallout, "floor" | "group">> = {},
): LayoutCallout {
  return {
    id,
    name,
    floor: extra.floor ?? "default",
    regions: [{ kind: "polygon", points }],
    ...(extra.group ? { group: extra.group } : {}),
  };
}
