import { NOTE_BOOKMARK_TITLE } from "../constants";
import type { Stroke } from "../types";

export type TextStroke = Extract<Stroke, { type: "text" }>;

export function strokeTitle(st: Stroke): string {
  if (st.type === "text") return st.text;
  if (st.type === "bookmark") {
    const text = st.text.trim();
    return text !== "" ? text : NOTE_BOOKMARK_TITLE;
  }
  if (st.type === "pen") return "Pen";
  return "Arrow";
}

export function strokeWindowKind(win: { start: number; end: number } | null): string {
  if (!win) return "Whole round";
  if (win.end <= win.start) return "Pin";
  return "Moment";
}

export function groupLabel(id: string): string {
  const m = /^g(\d+)$/.exec(id);
  return m ? `Group ${m[1]}` : id;
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
    else if (s.type === "pen" || s.type === "arrow") g.drawings += 1;
  }
  for (const g of by.values()) {
    g.texts.sort((a, b) => (a.start_tick ?? 0) - (b.start_tick ?? 0));
  }
  return [...by.values()].sort((a, b) => a.round - b.round);
}
