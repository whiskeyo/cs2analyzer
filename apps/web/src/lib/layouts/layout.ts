import { CALLOUT_PALETTE } from "./constants";
import { formatLayout } from "@/lib/layout/format.ts";
export { formatLayout };
import { emptyMapLayout, LAYOUT_SCHEMA, parseMapLayout } from "@/lib/layout/schema.ts";
import type { LayoutCallout, LayoutRegion, MapLayout } from "./types";
import { nudgeGroupOrder, renameGroup, renameGroupOrder } from "./groups";
import { syncGroupOrder } from "@/lib/layout/schema.ts";

export { LAYOUT_SCHEMA, parseMapLayout };
export const emptyLayout = emptyMapLayout;

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

export function regionLabel(region: LayoutRegion): string {
  if (region.kind === "circle") return `Circle r${Math.round(region.radius)}`;
  return `Polygon (${region.points.length})`;
}

export function calloutShapeSummary(callout: LayoutCallout): string {
  if (callout.regions.length !== 1) return `${callout.regions.length} regions`;
  const only = callout.regions[0];
  if (only?.kind === "circle") return "Circle";
  if (only?.kind === "polygon") return `${only.points.length} vertices`;
  return "Empty";
}

export function appendCalloutRegion(
  callouts: LayoutCallout[],
  id: string,
  region: LayoutCallout["regions"][number],
): LayoutCallout[] {
  return callouts.map((c) => (c.id === id ? { ...c, regions: [...c.regions, region] } : c));
}

export function removeCalloutRegion(
  callouts: LayoutCallout[],
  id: string,
  regionIndex: number,
): LayoutCallout[] {
  return callouts.map((c) => {
    if (c.id !== id || c.regions.length <= 1) return c;
    if (regionIndex < 0 || regionIndex >= c.regions.length) return c;
    return { ...c, regions: c.regions.filter((_, i) => i !== regionIndex) };
  });
}

export function replaceCalloutRegion(
  callouts: LayoutCallout[],
  id: string,
  regionIndex: number,
  region: LayoutCallout["regions"][number],
): LayoutCallout[] {
  return callouts.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      regions: c.regions.map((current, i) => (i === regionIndex ? region : current)),
    };
  });
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
