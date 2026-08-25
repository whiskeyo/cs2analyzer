import {
  DEFAULT_TICK_RATE,
  NOTE_GROUP_NAME_MAX,
  NOTE_LAYER_NAME,
  NOTE_MOMENT_MIN_SECONDS,
  NOTE_MOMENT_SECONDS,
} from "./constants";
import type { Round, Stroke } from "./types";

export type TextStroke = Extract<Stroke, { type: "text" }>;

export function overlayWindow(
  st: Stroke,
  all: readonly Stroke[] = [st],
): { start: number; end: number } | null {
  const members =
    st.group != null && st.group !== ""
      ? all.filter((s) => s.group === st.group && s.round === st.round)
      : [st];
  const timed = (members.length > 0 ? members : [st]).filter((s) => s.start_tick != null);
  if (timed.length === 0) return null;
  const start = Math.min(...timed.map((s) => s.start_tick as number));
  const end = Math.max(...timed.map((s) => s.end_tick ?? (s.start_tick as number)));
  return { start, end };
}

/** Round-scoped overlays show for the whole round; timed ones only inside the window. */
export function overlayVisible(
  st: Stroke,
  tick: number,
  round: number,
  all: readonly Stroke[] = [st],
): boolean {
  if (st.hidden) return false;
  if (st.round !== round) return false;
  const win = overlayWindow(st, all);
  if (!win) return true;
  return tick >= win.start && tick <= win.end;
}

export function momentBounds(
  tick: number,
  roundEnd: number,
  tickRate: number,
): { start_tick: number; end_tick: number } {
  const span = Math.round(NOTE_MOMENT_SECONDS * (tickRate || DEFAULT_TICK_RATE));
  let end = tick + span;
  if (roundEnd > 0) end = Math.min(end, roundEnd);
  return { start_tick: tick, end_tick: Math.max(tick, end) };
}

export function withMoment(
  st: Stroke,
  moment: boolean,
  tick: number,
  roundEnd: number,
  tickRate: number,
): Stroke {
  if (!moment) return st;
  return { ...st, ...momentBounds(tick, roundEnd, tickRate) };
}

export function noteRounds(strokes: Stroke[]): Set<number> {
  return new Set(strokes.map((s) => s.round));
}

export function earliestTimedTick(strokes: Stroke[], round: number): number | undefined {
  let min: number | undefined;
  for (const s of strokes) {
    if (s.round !== round || s.start_tick == null) continue;
    if (min == null || s.start_tick < min) min = s.start_tick;
  }
  return min;
}

export function overlayJumpTick(strokes: Stroke[], round: Round): number {
  return (earliestTimedTick(strokes, round.number) ?? round.freeze_end_tick) || round.start_tick;
}

export function strokeTitle(st: Stroke): string {
  if (st.type === "text") return st.text;
  if (st.type === "pen") return "Pen";
  return "Arrow";
}

export function groupLabel(id: string): string {
  const m = /^g(\d+)$/.exec(id);
  return m ? `Group ${m[1]}` : id;
}

export function momentLengthSeconds(
  st: Stroke,
  tickRate: number,
  all: readonly Stroke[] = [st],
): number | null {
  const win = overlayWindow(st, all);
  if (!win) return null;
  const rate = tickRate || DEFAULT_TICK_RATE;
  return (win.end - win.start) / rate;
}

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

function stripWindow(st: Stroke): Stroke {
  const next = { ...st };
  delete next.start_tick;
  delete next.end_tick;
  return next;
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

function indexesInSameGroup(strokes: readonly Stroke[], index: number): number[] {
  const st = strokes[index];
  if (!st) return [];
  if (!st.group) return [index];
  return strokes.flatMap((s, i) => (s.group === st.group ? [i] : []));
}

export function setMomentSeconds(
  strokes: Stroke[],
  index: number,
  seconds: number,
  tickRate: number,
  roundEnd: number,
  fallbackStart: number,
): Stroke[] {
  const st = strokes[index];
  if (!st) return strokes;
  const rate = tickRate || DEFAULT_TICK_RATE;
  const start = st.start_tick ?? overlayWindow(st, strokes)?.start ?? fallbackStart;
  const span = Math.max(Math.round(NOTE_MOMENT_MIN_SECONDS * rate), Math.round(seconds * rate));
  let end = start + span;
  if (roundEnd > 0) end = Math.min(end, roundEnd);
  end = Math.max(start, end);
  const targets = new Set(indexesInSameGroup(strokes, index));
  return strokes.map((s, i) => (targets.has(i) ? { ...s, start_tick: start, end_tick: end } : s));
}

export function clearMomentWindow(strokes: Stroke[], index: number): Stroke[] {
  const targets = new Set(indexesInSameGroup(strokes, index));
  if (targets.size === 0) return strokes;
  return strokes.map((s, i) => (targets.has(i) ? stripWindow(s) : s));
}

export function setMomentEdge(
  strokes: Stroke[],
  index: number,
  edge: "start" | "end",
  tick: number,
  roundStart: number,
  roundEnd: number,
  tickRate: number,
): Stroke[] {
  const st = strokes[index];
  if (!st) return strokes;
  const rate = tickRate || DEFAULT_TICK_RATE;
  const fallback = Math.round(NOTE_MOMENT_SECONDS * rate);
  const minSpan = Math.round(NOTE_MOMENT_MIN_SECONDS * rate);
  const win = overlayWindow(st, strokes);
  let start = win?.start ?? tick;
  let end = win?.end ?? tick;
  if (!win) {
    if (edge === "start") {
      start = tick;
      end = tick + fallback;
    } else {
      start = tick - fallback;
      end = tick;
    }
  } else if (edge === "start") {
    start = tick;
    if (start >= end) end = start + fallback;
  } else if (tick > start) {
    end = tick;
  } else {
    end = Math.max(end, start + fallback);
  }
  return stampWindow(strokes, index, start, end, roundStart, roundEnd, minSpan);
}

/** Set In or Out from a round-clock time (seconds after freeze). Can pass 60 for 1:00. */
export function setMomentClockEdge(
  strokes: Stroke[],
  index: number,
  edge: "start" | "end",
  seconds: number,
  origin: number,
  roundStart: number,
  roundEnd: number,
  tickRate: number,
): Stroke[] {
  const st = strokes[index];
  if (!st || !Number.isFinite(seconds)) return strokes;
  const rate = tickRate || DEFAULT_TICK_RATE;
  const fallback = Math.round(NOTE_MOMENT_SECONDS * rate);
  const minSpan = Math.round(NOTE_MOMENT_MIN_SECONDS * rate);
  const win = overlayWindow(st, strokes);
  let start = win?.start ?? origin;
  let end = win?.end ?? (roundEnd > origin ? roundEnd : origin + fallback);
  const tick = origin + Math.max(0, seconds) * rate;
  if (edge === "start") start = tick;
  else end = tick;
  return stampWindow(strokes, index, start, end, roundStart, roundEnd, minSpan);
}

function stampWindow(
  strokes: Stroke[],
  index: number,
  start: number,
  end: number,
  roundStart: number,
  roundEnd: number,
  minSpan: number,
): Stroke[] {
  start = Math.max(roundStart, start);
  end = Math.max(roundStart, end);
  if (roundEnd > 0) {
    start = Math.min(start, roundEnd);
    end = Math.min(end, roundEnd);
  }
  if (end < start + minSpan) {
    end = start + minSpan;
    if (roundEnd > 0 && end > roundEnd) {
      end = roundEnd;
      start = Math.max(roundStart, end - minSpan);
    }
  }
  const targets = new Set(indexesInSameGroup(strokes, index));
  return strokes.map((s, i) => (targets.has(i) ? { ...s, start_tick: start, end_tick: end } : s));
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

export interface NoteItem {
  index: number;
  stroke: Stroke;
}

export interface NoteRound {
  round: number;
  items: NoteItem[];
}

export function notesByRound(strokes: Stroke[]): NoteRound[] {
  const by = new Map<number, NoteItem[]>();
  strokes.forEach((stroke, index) => {
    const list = by.get(stroke.round) ?? [];
    list.push({ index, stroke });
    by.set(stroke.round, list);
  });
  for (const items of by.values()) {
    items.sort(
      (a, b) => (a.stroke.start_tick ?? 0) - (b.stroke.start_tick ?? 0) || a.index - b.index,
    );
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([round, items]) => ({ round, items }));
}

export interface NoteCluster {
  group: string | null;
  items: NoteItem[];
}

export function clusterNoteRound(items: NoteItem[]): NoteCluster[] {
  const order: string[] = [];
  const by = new Map<string, NoteItem[]>();
  const none: NoteItem[] = [];
  for (const item of items) {
    const id = item.stroke.group;
    if (!id) {
      none.push(item);
      continue;
    }
    let list = by.get(id);
    if (!list) {
      list = [];
      by.set(id, list);
      order.push(id);
    }
    list.push(item);
  }
  const clustered: NoteCluster[] = order.map((group) => ({ group, items: by.get(group) ?? [] }));
  if (none.length > 0) clustered.push({ group: null, items: none });
  return clustered;
}

export interface NoteGroup {
  round: number;
  texts: TextStroke[];
  drawings: number;
}

export function groupOverlays(strokes: Stroke[]): NoteGroup[] {
  const by = new Map<number, NoteGroup>();
  for (const s of strokes) {
    let g = by.get(s.round);
    if (!g) {
      g = { round: s.round, texts: [], drawings: 0 };
      by.set(s.round, g);
    }
    if (s.type === "text") g.texts.push(s);
    else g.drawings += 1;
  }
  for (const g of by.values()) {
    g.texts.sort((a, b) => (a.start_tick ?? 0) - (b.start_tick ?? 0));
  }
  return [...by.values()].sort((a, b) => a.round - b.round);
}
