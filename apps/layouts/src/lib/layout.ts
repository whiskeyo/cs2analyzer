import { CALLOUT_PALETTE, MIN_POLYGON_VERTICES } from "./constants";
import type { LayoutCallout, LayoutFloor, MapLayout, Point } from "./types";

export const LAYOUT_SCHEMA = 1 as const;

export function emptyLayout(map: string): MapLayout {
  return { schema: LAYOUT_SCHEMA, map, callouts: [] };
}

export function formatLayout(layout: MapLayout): string {
  return `${JSON.stringify(layout, null, 2)}\n`;
}

export function slugId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "callout";
}

export function uniqueId(base: string, used: Iterable<string>): string {
  const taken = new Set(used);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function calloutColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CALLOUT_PALETTE[hash % CALLOUT_PALETTE.length] ?? CALLOUT_PALETTE[0];
}

function isPoint(value: unknown): value is Point {
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
  const polygon: Point[] = [];
  for (const p of row.polygon) {
    if (!isPoint(p)) return null;
    polygon.push({ x: p.x, y: p.y });
  }
  return { id: row.id, name: row.name, floor: row.floor, polygon };
}

/** Returns null when the payload is not a layout object. Invalid callouts are dropped. */
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

export function nextCalloutName(callouts: LayoutCallout[]): string {
  return `Callout ${callouts.length + 1}`;
}
