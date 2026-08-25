import { NOTE_GROUP_NAME_MAX, NOTE_LAYER_NAME } from "../constants";
import type { Stroke } from "../types";
import { overlayWindow } from "./visibility";

function groupSerial(id: string): number {
  const auto = /^g(\d+)$/.exec(id);
  if (auto) return Number(auto[1]);
  const named = /^Group (\d+)$/.exec(id);
  if (named) return Number(named[1]);
  return 0;
}

export function nextGroupId(strokes: readonly Stroke[]): string {
  let max = 0;
  for (const s of strokes) {
    max = Math.max(max, groupSerial(s.group ?? ""));
  }
  return `Group ${max + 1}`;
}

function stripGroup(st: Stroke): Stroke {
  const next = { ...st };
  delete next.group;
  return next;
}

function dissolveSmallGroups(strokes: Stroke[]): Stroke[] {
  const counts = new Map<string, number>();
  for (const s of strokes) {
    if (!s.group) continue;
    const key = `${s.round}:${s.group}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return strokes.map((s) => {
    if (!s.group) return s;
    if ((counts.get(`${s.round}:${s.group}`) ?? 0) >= 2) return s;
    return stripGroup(s);
  });
}

function groupWindowFor(
  strokes: readonly Stroke[],
  group: string,
  round: number,
): { start: number; end: number } | null {
  const member = strokes.find((s) => s.group === group && s.round === round);
  if (!member) return null;
  return overlayWindow(member, strokes);
}

export function setStrokesHidden(strokes: Stroke[], indexes: number[], hidden: boolean): Stroke[] {
  const targets = new Set(indexes);
  return strokes.map((s, i) => {
    if (!targets.has(i)) return s;
    const next = { ...s };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    return next;
  });
}

export function groupStrokes(strokes: Stroke[], indexes: number[]): Stroke[] {
  const unique = [...new Set(indexes)].filter((i) => strokes[i] != null);
  if (unique.length < 2) return strokes;
  const round = strokes[unique[0]].round;
  if (unique.some((i) => strokes[i].round !== round)) return strokes;
  const members = unique.map((i) => strokes[i]);
  const timed = members.filter((s) => s.start_tick != null);
  let window: { start_tick: number; end_tick: number } | undefined;
  if (timed.length > 0) {
    const start = Math.min(...timed.map((s) => s.start_tick as number));
    const end = Math.max(...timed.map((s) => s.end_tick ?? (s.start_tick as number)));
    window = { start_tick: start, end_tick: Math.max(start, end) };
  }
  const group = nextGroupId(strokes);
  return strokes.map((s, i) => {
    if (!unique.includes(i)) return s;
    const next = { ...s, group };
    if (window) {
      next.start_tick = window.start_tick;
      next.end_tick = window.end_tick;
    }
    return next;
  });
}

export function ungroupStrokes(strokes: Stroke[], indexes: number[]): Stroke[] {
  const groups = new Set<string>();
  for (const i of indexes) {
    const id = strokes[i]?.group;
    if (id) groups.add(id);
  }
  if (groups.size === 0) return strokes;
  return strokes.map((s) => (s.group && groups.has(s.group) ? stripGroup(s) : s));
}

export function renameGroup(strokes: Stroke[], fromId: string, name: string): Stroke[] {
  const nextName = name.trim().slice(0, NOTE_GROUP_NAME_MAX);
  if (!fromId || nextName === "" || nextName === fromId) return strokes;
  const renamed = strokes.map((s) => (s.group === fromId ? { ...s, group: nextName } : s));
  return renamed.map((s) => {
    if (s.group !== nextName) return s;
    const peers = renamed.filter((p) => p.group === nextName && p.round === s.round);
    const timed = peers.filter((p) => p.start_tick != null);
    if (timed.length === 0) return s;
    const start = Math.min(...timed.map((p) => p.start_tick as number));
    const end = Math.max(...timed.map((p) => p.end_tick ?? (p.start_tick as number)));
    return { ...s, start_tick: start, end_tick: end };
  });
}

export function assignStrokesToGroup(
  strokes: Stroke[],
  indexes: number[],
  group: string | null,
): Stroke[] {
  const unique = [...new Set(indexes)].filter((i) => strokes[i] != null);
  if (unique.length === 0) return strokes;
  const round = strokes[unique[0]].round;
  if (unique.some((i) => strokes[i].round !== round)) return strokes;
  if (group == null) {
    return dissolveSmallGroups(strokes.map((s, i) => (unique.includes(i) ? stripGroup(s) : s)));
  }
  const exists = strokes.some((s) => s.group === group && s.round === round);
  if (!exists) return strokes;
  const win = groupWindowFor(strokes, group, round);
  return dissolveSmallGroups(
    strokes.map((s, i) => {
      if (!unique.includes(i)) return s;
      if (s.round !== round) return s;
      const next = { ...s, group };
      if (win) {
        next.start_tick = win.start;
        next.end_tick = win.end;
      } else {
        delete next.start_tick;
        delete next.end_tick;
      }
      return next;
    }),
  );
}

/** Drop onto a layer, the round's top ungroup slot, or the bottom new-group slot. */
export type NoteDropDest =
  | { round: number; kind: "ungroup" }
  | { round: number; kind: "new-group" }
  | { round: number; kind: "into"; group: string };

export function dropStrokesOn(strokes: Stroke[], indexes: number[], dest: NoteDropDest): Stroke[] {
  const unique = [...new Set(indexes)].filter((i) => strokes[i] != null);
  if (unique.length === 0) return strokes;
  if (unique.some((i) => strokes[i].round !== dest.round)) return strokes;
  if (dest.kind === "ungroup") return assignStrokesToGroup(strokes, unique, null);
  if (dest.kind === "into") return assignStrokesToGroup(strokes, unique, dest.group);
  if (unique.length < 2) return strokes;
  const shared = strokes[unique[0]]?.group;
  if (
    shared &&
    unique.every((i) => strokes[i].group === shared) &&
    strokes.filter((s) => s.group === shared && s.round === dest.round).length === unique.length
  ) {
    return strokes;
  }
  return dissolveSmallGroups(groupStrokes(strokes, unique));
}

export function canGroupIndexes(strokes: readonly Stroke[], indexes: number[]): boolean {
  const unique = [...new Set(indexes)].filter((i) => strokes[i] != null);
  if (unique.length < 2) return false;
  const round = strokes[unique[0]].round;
  return unique.every((i) => strokes[i].round === round);
}

export function isDrawingStroke(st: Stroke): boolean {
  return st.type === "pen" || st.type === "arrow";
}

export function looseDrawingIndexes(strokes: readonly Stroke[], round: number): number[] {
  return strokes.flatMap((s, i) =>
    s.round === round && s.group == null && isDrawingStroke(s) ? [i] : [],
  );
}

export function nextLayerName(strokes: readonly Stroke[]): string {
  const used = new Set(
    strokes.map((s) => s.group).filter((g): g is string => g != null && g !== ""),
  );
  if (!used.has(NOTE_LAYER_NAME)) return NOTE_LAYER_NAME;
  let n = 2;
  while (used.has(`${NOTE_LAYER_NAME} ${n}`)) n += 1;
  return `${NOTE_LAYER_NAME} ${n}`;
}

export function squashStrokes(strokes: Stroke[], indexes: number[]): Stroke[] {
  const grouped = groupStrokes(strokes, indexes);
  if (grouped === strokes) return strokes;
  const want = new Set(indexes);
  let fromId: string | undefined;
  for (let i = 0; i < grouped.length; i++) {
    if (!want.has(i)) continue;
    if (grouped[i].group) {
      fromId = grouped[i].group;
      break;
    }
  }
  if (!fromId) return grouped;
  return renameGroup(grouped, fromId, nextLayerName(strokes));
}

export function squashLooseDrawings(strokes: Stroke[], round: number): Stroke[] {
  return squashStrokes(strokes, looseDrawingIndexes(strokes, round));
}
