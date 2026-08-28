import {
  CALLOUT_PALETTE,
  LAYOUT_GROUP_NAME_MAX,
  LAYOUT_JSON_PRINT_WIDTH,
  MIN_POLYGON_VERTICES,
} from "./constants";
import type { LayoutCallout, LayoutFloor, MapLayout, Point } from "./types";
import {
  dissolveSmallGroups,
  nudgeGroupOrder,
  renameGroup,
  renameGroupOrder,
  syncGroupOrder,
} from "./groups";

export const LAYOUT_SCHEMA = 1 as const;

export function emptyLayout(map: string): MapLayout {
  return { schema: LAYOUT_SCHEMA, map, callouts: [] };
}

const JSON_INDENT = 2;

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Pretty-print JSON the way Prettier does (printWidth 100, indent 2, no trailing commas). */
function formatJson(value: unknown, depth = 0, prefixLen = 0): string {
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(isJsonPrimitive)) {
      const compact = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
      if (prefixLen + compact.length <= LAYOUT_JSON_PRINT_WIDTH) return compact;
    }
    const innerDepth = depth + 1;
    const inner = " ".repeat(innerDepth * JSON_INDENT);
    const pad = " ".repeat(depth * JSON_INDENT);
    const items = value.map((item) => `${inner}${formatJson(item, innerDepth, inner.length)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const innerDepth = depth + 1;
    const inner = " ".repeat(innerDepth * JSON_INDENT);
    const pad = " ".repeat(depth * JSON_INDENT);
    const row = value as Record<string, unknown>;
    const items = keys.map((key) => {
      const label = `${JSON.stringify(key)}: `;
      const printed = formatJson(row[key], innerDepth, inner.length + label.length);
      return `${inner}${label}${printed}`;
    });
    return `{\n${items.join(",\n")}\n${pad}}`;
  }
  return "null";
}

export function formatLayout(layout: MapLayout): string {
  const body =
    layout.groups && layout.groups.length > 0
      ? {
          schema: layout.schema,
          map: layout.map,
          groups: layout.groups,
          callouts: layout.callouts,
        }
      : { schema: layout.schema, map: layout.map, callouts: layout.callouts };
  return `${formatJson(body)}\n`;
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
    group?: unknown;
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
  const group =
    typeof row.group === "string" ? row.group.trim().slice(0, LAYOUT_GROUP_NAME_MAX) : "";
  return {
    id: row.id,
    name: row.name,
    floor: row.floor,
    polygon,
    ...(group ? { group } : {}),
  };
}

function parseGroupNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim().slice(0, LAYOUT_GROUP_NAME_MAX);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names.length > 0 ? names : undefined;
}

/** Returns null when the payload is not a layout object. Invalid callouts are dropped. */
export function parseMapLayout(data: unknown, expectedMap?: string): MapLayout | null {
  if (typeof data !== "object" || data == null) return null;
  const row = data as { schema?: unknown; map?: unknown; groups?: unknown; callouts?: unknown };
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
  const dissolved = dissolveSmallGroups(callouts);
  const preferred = parseGroupNames(row.groups);
  const groups = preferred ? syncGroupOrder(preferred, dissolved) : undefined;
  return {
    schema: LAYOUT_SCHEMA,
    map: row.map,
    callouts: dissolved,
    ...(groups ? { groups } : {}),
  };
}

export function layoutWithCallouts(layout: MapLayout, callouts: LayoutCallout[]): MapLayout {
  const next: MapLayout = { schema: layout.schema, map: layout.map, callouts };
  if (layout.groups && layout.groups.length > 0) {
    const groups = syncGroupOrder(layout.groups, callouts);
    if (groups) next.groups = groups;
  }
  return next;
}

export function renameLayoutGroup(layout: MapLayout, fromId: string, name: string): MapLayout {
  const callouts = renameGroup(layout.callouts, fromId, name);
  if (callouts === layout.callouts) return layout;
  const member = layout.callouts.find((c) => c.group === fromId);
  const toId = member ? (callouts.find((c) => c.id === member.id)?.group ?? fromId) : fromId;
  const base: MapLayout =
    layout.groups && layout.groups.length > 0
      ? { ...layout, groups: renameGroupOrder(layout.groups, fromId, toId), callouts }
      : { ...layout, callouts };
  return layoutWithCallouts(base, callouts);
}

export function nudgeLayoutGroup(layout: MapLayout, id: string, delta: -1 | 1): MapLayout {
  const order = syncGroupOrder(layout.groups, layout.callouts);
  if (!order) return layout;
  const next = nudgeGroupOrder(order, id, delta);
  if (next.length === order.length && next.every((name, i) => name === order[i])) return layout;
  return { ...layout, groups: next };
}

export function nextCalloutName(callouts: LayoutCallout[]): string {
  return `Callout ${callouts.length + 1}`;
}

export function moveCallout(callouts: LayoutCallout[], from: number, to: number): LayoutCallout[] {
  if (from === to || from < 0 || to < 0 || from >= callouts.length || to >= callouts.length) {
    return callouts;
  }
  const next = callouts.slice();
  const [item] = next.splice(from, 1);
  if (!item) return callouts;
  next.splice(to, 0, item);
  return next;
}

export function moveCalloutById(
  callouts: LayoutCallout[],
  fromId: string,
  toId: string,
): LayoutCallout[] {
  const from = callouts.findIndex((c) => c.id === fromId);
  const to = callouts.findIndex((c) => c.id === toId);
  return moveCallout(callouts, from, to);
}
