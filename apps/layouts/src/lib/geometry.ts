import { CIRCLE_SEGMENTS, MIN_POLYGON_VERTICES, MIN_SHAPE_SIZE } from "./constants";
import type { LayoutDraft, Point } from "./types";

/** Even-odd ray cast. Vertices on the edge count as inside. */
export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
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

export function polygonArea(polygon: Point[]): number {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    area += b.x * a.y - a.x * b.y;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p.x;
    y += p.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

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

export function circlePolygon(
  center: Point,
  edge: Point,
  segments: number = CIRCLE_SEGMENTS,
): Point[] {
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
  const count = Math.max(MIN_POLYGON_VERTICES, segments);
  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    out.push({
      x: center.x + Math.cos(t) * radius,
      y: center.y + Math.sin(t) * radius,
    });
  }
  return out;
}

export function shapeIsLargeEnough(draft: Exclude<LayoutDraft, { kind: "polygon" }>): boolean {
  if (draft.kind === "rect") {
    return (
      Math.abs(draft.end.x - draft.start.x) >= MIN_SHAPE_SIZE &&
      Math.abs(draft.end.y - draft.start.y) >= MIN_SHAPE_SIZE
    );
  }
  return Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) >= MIN_SHAPE_SIZE;
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

export function draftToPolygon(draft: LayoutDraft, cursor?: Point | null): Point[] {
  if (draft.kind === "polygon") {
    return cursor ? [...draft.points, cursor] : draft.points;
  }
  if (draft.kind === "rect") {
    return rectPolygon(draft.start, draft.end);
  }
  return circlePolygon(draft.start, draft.end);
}
