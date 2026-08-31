import type { LayoutCallout, LayoutFloor, LayoutPoint, MapLayout } from "./types.ts";

export const LAYOUT_SCHEMA = 1 as const;
export const LAYOUT_GROUP_NAME_MAX = 40;
const MIN_POLYGON_VERTICES = 3;

export function emptyMapLayout(map: string): MapLayout {
  return { schema: LAYOUT_SCHEMA, map, callouts: [] };
}

function isPoint(value: unknown): value is LayoutPoint {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const p = value as { x?: unknown; y?: unknown };
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isFloor(value: unknown): value is LayoutFloor {
  return value === "default" || value === "lower";
}

function parseCallout(value: unknown): LayoutCallout | null {
  if (typeof value !== "object" || value == null) {
    return null;
  }
  const row = value as {
    id?: unknown;
    name?: unknown;
    floor?: unknown;
    group?: unknown;
    polygon?: unknown;
  };
  if (typeof row.id !== "string" || row.id.length === 0) {
    return null;
  }
  if (typeof row.name !== "string" || row.name.length === 0) {
    return null;
  }
  if (!isFloor(row.floor)) {
    return null;
  }
  if (!Array.isArray(row.polygon) || row.polygon.length < MIN_POLYGON_VERTICES) {
    return null;
  }
  const polygon: LayoutPoint[] = [];
  for (const p of row.polygon) {
    if (!isPoint(p)) {
      return null;
    }
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
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const name = item.trim().slice(0, LAYOUT_GROUP_NAME_MAX);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names.length > 0 ? names : undefined;
}

export function dissolveSmallGroups(callouts: LayoutCallout[]): LayoutCallout[] {
  const counts = new Map<string, number>();
  for (const c of callouts) {
    if (!c.group) {
      continue;
    }
    counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  }
  return callouts.map((c) => {
    if (!c.group) {
      return c;
    }
    if ((counts.get(c.group) ?? 0) >= 2) {
      return c;
    }
    const next = { ...c };
    delete next.group;
    return next;
  });
}

/** Live group ids in first-appearance order (singletons already dissolved). */
export function liveGroupIds(callouts: readonly LayoutCallout[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const callout of callouts) {
    const id = callout.group;
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    order.push(id);
  }
  return order;
}

/** Keep `preferred` names that still exist; append any new live groups. */
export function syncGroupOrder(
  preferred: readonly string[] | undefined,
  callouts: readonly LayoutCallout[],
): string[] | undefined {
  const live = liveGroupIds(callouts);
  if (live.length === 0) {
    return undefined;
  }
  const liveSet = new Set(live);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of preferred ?? []) {
    if (!liveSet.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  for (const id of live) {
    if (seen.has(id)) {
      continue;
    }
    next.push(id);
  }
  return next;
}

/** Returns null when the payload is not a layout object. Invalid callouts are dropped. */
export function parseMapLayout(data: unknown, expectedMap?: string): MapLayout | null {
  if (typeof data !== "object" || data == null) {
    return null;
  }
  const row = data as {
    schema?: unknown;
    map?: unknown;
    groups?: unknown;
    callouts?: unknown;
  };
  if (row.schema !== LAYOUT_SCHEMA) {
    return null;
  }
  if (typeof row.map !== "string" || row.map.length === 0) {
    return null;
  }
  if (expectedMap && row.map !== expectedMap) {
    return null;
  }
  if (!Array.isArray(row.callouts)) {
    return null;
  }
  const seen = new Set<string>();
  const callouts: LayoutCallout[] = [];
  for (const item of row.callouts) {
    const callout = parseCallout(item);
    if (!callout || seen.has(callout.id)) {
      continue;
    }
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
