import { LAYOUT_GROUP_NAME_MAX } from "./constants";
import type { LayoutCallout } from "./types";

function groupSerial(id: string): number {
  const auto = /^g(\d+)$/.exec(id);
  if (auto) return Number(auto[1]);
  const named = /^Group (\d+)$/.exec(id);
  if (named) return Number(named[1]);
  return 0;
}

export function nextGroupId(callouts: readonly LayoutCallout[]): string {
  let max = 0;
  for (const c of callouts) {
    max = Math.max(max, groupSerial(c.group ?? ""));
  }
  return `Group ${max + 1}`;
}

export function groupLabel(id: string): string {
  const m = /^g(\d+)$/.exec(id);
  return m ? `Group ${m[1]}` : id;
}

function stripGroup(callout: LayoutCallout): LayoutCallout {
  const next = { ...callout };
  delete next.group;
  return next;
}

export function dissolveSmallGroups(callouts: LayoutCallout[]): LayoutCallout[] {
  const counts = new Map<string, number>();
  for (const c of callouts) {
    if (!c.group) continue;
    counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  }
  return callouts.map((c) => {
    if (!c.group) return c;
    if ((counts.get(c.group) ?? 0) >= 2) return c;
    return stripGroup(c);
  });
}

export function groupCallouts(callouts: LayoutCallout[], ids: string[]): LayoutCallout[] {
  const want = new Set(ids);
  const unique = callouts.filter((c) => want.has(c.id)).map((c) => c.id);
  if (unique.length < 2) return callouts;
  const group = nextGroupId(callouts);
  return callouts.map((c) => (want.has(c.id) ? { ...c, group } : c));
}

export function ungroupCallouts(callouts: LayoutCallout[], ids: string[]): LayoutCallout[] {
  const groups = new Set<string>();
  const want = new Set(ids);
  for (const c of callouts) {
    if (want.has(c.id) && c.group) groups.add(c.group);
  }
  if (groups.size === 0) return callouts;
  return callouts.map((c) => (c.group && groups.has(c.group) ? stripGroup(c) : c));
}

export function renameGroup(
  callouts: LayoutCallout[],
  fromId: string,
  name: string,
): LayoutCallout[] {
  const nextName = name.trim().slice(0, LAYOUT_GROUP_NAME_MAX);
  if (!fromId || nextName === "" || nextName === fromId) return callouts;
  return callouts.map((c) => (c.group === fromId ? { ...c, group: nextName } : c));
}

export function renameGroupOrder(order: readonly string[], fromId: string, toId: string): string[] {
  return order.map((id) => (id === fromId ? toId : id));
}

/** Live group ids in first-appearance order (singletons already dissolved). */
export function liveGroupIds(callouts: readonly LayoutCallout[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const callout of callouts) {
    const id = callout.group;
    if (!id || seen.has(id)) continue;
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
  if (live.length === 0) return undefined;
  const liveSet = new Set(live);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of preferred ?? []) {
    if (!liveSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  for (const id of live) {
    if (seen.has(id)) continue;
    next.push(id);
  }
  return next;
}

export function nudgeGroupOrder(order: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order.slice();
  const next = order.slice();
  const [item] = next.splice(from, 1);
  if (!item) return order.slice();
  next.splice(to, 0, item);
  return next;
}

export function assignCalloutsToGroup(
  callouts: LayoutCallout[],
  ids: string[],
  group: string | null,
): LayoutCallout[] {
  const want = new Set(ids);
  if (want.size === 0) return callouts;
  if (group == null) {
    return dissolveSmallGroups(callouts.map((c) => (want.has(c.id) ? stripGroup(c) : c)));
  }
  const exists = callouts.some((c) => c.group === group);
  if (!exists) return callouts;
  return dissolveSmallGroups(callouts.map((c) => (want.has(c.id) ? { ...c, group } : c)));
}

export type CalloutDropDest =
  { kind: "ungroup" } | { kind: "new-group" } | { kind: "into"; group: string };

export function dropCalloutsOn(
  callouts: LayoutCallout[],
  ids: string[],
  dest: CalloutDropDest,
): LayoutCallout[] {
  const want = [...new Set(ids)].filter((id) => callouts.some((c) => c.id === id));
  if (want.length === 0) return callouts;
  if (dest.kind === "ungroup") return assignCalloutsToGroup(callouts, want, null);
  if (dest.kind === "into") return assignCalloutsToGroup(callouts, want, dest.group);
  if (want.length < 2) return callouts;
  const shared = callouts.find((c) => c.id === want[0])?.group;
  if (
    shared &&
    want.every((id) => callouts.find((c) => c.id === id)?.group === shared) &&
    callouts.filter((c) => c.group === shared).length === want.length
  ) {
    return callouts;
  }
  return dissolveSmallGroups(groupCallouts(callouts, want));
}

export function canGroupIds(callouts: readonly LayoutCallout[], ids: string[]): boolean {
  const want = new Set(ids);
  return callouts.filter((c) => want.has(c.id)).length >= 2;
}

export function canUngroupIds(callouts: readonly LayoutCallout[], ids: string[]): boolean {
  if (ids.length < 2) return false;
  const want = new Set(ids);
  return callouts.some((c) => want.has(c.id) && Boolean(c.group));
}

export interface CalloutCluster {
  group: string | null;
  callouts: LayoutCallout[];
}

export function clusterCallouts(
  callouts: readonly LayoutCallout[],
  groupOrder?: readonly string[],
): CalloutCluster[] {
  const by = new Map<string, LayoutCallout[]>();
  const none: LayoutCallout[] = [];
  for (const callout of callouts) {
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
  const order = syncGroupOrder(groupOrder, callouts) ?? [];
  const clustered: CalloutCluster[] = order.map((group) => ({
    group,
    callouts: by.get(group) ?? [],
  }));
  if (none.length > 0) clustered.push({ group: null, callouts: none });
  return clustered;
}

export function idsForDrag(id: string, selected: string[]): string[] {
  return selected.includes(id) ? selected.slice() : [id];
}
