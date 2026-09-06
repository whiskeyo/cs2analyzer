import { MIN_POLYGON_VERTICES, MIN_SHAPE_SIZE } from "./constants";
import type { LayoutDraft, Point } from "./types";
import type { LayoutRegion } from "@/lib/layout/types.ts";

export { pointInPolygon, polygonArea, polygonCentroid } from "@/lib/layout/regions.ts";

export function translatePolygon(polygon: Point[], dx: number, dy: number): Point[] {
  return polygon.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function rectPolygon(a: Point, b: Point): Point[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function circleRadius(center: Point, edge: Point): number {
  return Math.hypot(edge.x - center.x, edge.y - center.y);
}

export function shapeIsLargeEnough(draft: Exclude<LayoutDraft, { kind: "polygon" }>): boolean {
  if (draft.kind === "rect") {
    return (
      Math.abs(draft.end.x - draft.start.x) >= MIN_SHAPE_SIZE &&
      Math.abs(draft.end.y - draft.start.y) >= MIN_SHAPE_SIZE
    );
  }
  return circleRadius(draft.start, draft.end) >= MIN_SHAPE_SIZE;
}

export function distanceToSegment(
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

/** Index of the edge from vertex i to i+1 (wrapping). */
export function nearestPolygonEdge(
  polygon: Point[],
  toScreen: (p: Point) => Point,
  sx: number,
  sy: number,
): { index: number; dist: number } | null {
  if (polygon.length < MIN_POLYGON_VERTICES) return null;
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (!a || !b) continue;
    const sa = toScreen(a);
    const sb = toScreen(b);
    const dist = distanceToSegment(sx, sy, sa.x, sa.y, sb.x, sb.y);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  if (best < 0) return null;
  return { index: best, dist: bestDist };
}

/** Insert a vertex at the midpoint of the edge that starts at `edgeIndex`. */
export function splitPolygonEdge(polygon: Point[], edgeIndex: number): Point[] {
  if (polygon.length < 2) return polygon.map((p) => ({ ...p }));
  const i = ((edgeIndex % polygon.length) + polygon.length) % polygon.length;
  const a = polygon[i];
  const b = polygon[(i + 1) % polygon.length];
  if (!a || !b) return polygon.map((p) => ({ ...p }));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return [
    ...polygon.slice(0, i + 1).map((p) => ({ ...p })),
    mid,
    ...polygon.slice(i + 1).map((p) => ({ ...p })),
  ];
}

export function draftToRegion(draft: LayoutDraft): LayoutRegion | null {
  if (draft.kind === "polygon") {
    if (draft.points.length < MIN_POLYGON_VERTICES) return null;
    return { kind: "polygon", points: draft.points.map((p) => ({ ...p })) };
  }
  if (!shapeIsLargeEnough(draft)) return null;
  if (draft.kind === "rect") {
    return { kind: "polygon", points: rectPolygon(draft.start, draft.end) };
  }
  return {
    kind: "circle",
    x: draft.start.x,
    y: draft.start.y,
    radius: circleRadius(draft.start, draft.end),
  };
}

export function draftPreviewPoints(draft: LayoutDraft, cursor?: Point | null): Point[] {
  if (draft.kind === "polygon") {
    return cursor ? [...draft.points, cursor] : draft.points;
  }
  if (draft.kind === "rect") {
    return rectPolygon(draft.start, draft.end);
  }
  return [];
}
