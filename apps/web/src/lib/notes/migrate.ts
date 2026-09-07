import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { emptyNote } from "./note";
import type { Drawing, DrawingGroup, DrawingShape, Note, RoundNote, Stroke } from "./types";

function drawingFromStroke(st: Stroke): DrawingShape | null {
  if (st.type === "bookmark") return null;
  if (st.type === "pen") return { type: "pen", color: st.color, points: st.points };
  if (st.type === "arrow") return { type: "arrow", color: st.color, from: st.from, to: st.to };
  return {
    type: "text",
    color: st.color,
    x: st.x,
    y: st.y,
    text: st.text,
    ...(st.box_w != null ? { box_w: st.box_w } : {}),
    ...(st.box_h != null ? { box_h: st.box_h } : {}),
  };
}

function groupWindow(members: Stroke[]): Pick<DrawingGroup, "start_tick" | "end_tick"> {
  const timed = members.filter((s) => s.start_tick != null);
  if (timed.length === 0) return {};
  const start = Math.min(...timed.map((s) => s.start_tick as number));
  const end = Math.max(...timed.map((s) => s.end_tick ?? (s.start_tick as number)));
  return { start_tick: start, end_tick: end };
}

function toDrawing(st: Stroke, shape: DrawingShape): Drawing {
  const drawing: Drawing = { ...shape };
  if (st.hidden) drawing.hidden = true;
  if (st.start_tick != null) drawing.start_tick = st.start_tick;
  if (st.end_tick != null) drawing.end_tick = st.end_tick;
  return drawing;
}

/** Bucket schema ≤2 strokes so each round owns a Note. */
export function strokesToRoundNotes(strokes: readonly Stroke[]): RoundNote[] {
  const byRound = new Map<number, Stroke[]>();
  for (const st of strokes) {
    const list = byRound.get(st.round) ?? [];
    list.push(st);
    byRound.set(st.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  return rounds.map((round) => ({ round, note: strokesToNote(byRound.get(round) ?? []) }));
}

export function strokesToNote(strokes: readonly Stroke[]): Note {
  const note = emptyNote();
  const groups = new Map<string, Stroke[]>();
  const groupOrder: string[] = [];
  for (const st of strokes) {
    if (st.type === "bookmark") {
      const text = st.text.trim() !== "" ? st.text : NOTE_BOOKMARK_TITLE;
      const tick = st.start_tick ?? 0;
      const mark: Note["bookmarks"][number] = { color: st.color, text, tick };
      if (st.start_tick != null) mark.start_tick = st.start_tick;
      if (st.end_tick != null) mark.end_tick = st.end_tick;
      if (st.hidden) mark.hidden = true;
      note.bookmarks.push(mark);
      continue;
    }
    const drawing = drawingFromStroke(st);
    if (!drawing) continue;
    const groupId = st.group?.trim();
    if (!groupId) {
      note.drawings.push(toDrawing(st, drawing));
      continue;
    }
    let members = groups.get(groupId);
    if (!members) {
      members = [];
      groups.set(groupId, members);
      groupOrder.push(groupId);
    }
    members.push(st);
  }
  for (const id of groupOrder) {
    const members = groups.get(id) ?? [];
    const drawings: Drawing[] = [];
    for (const st of members) {
      const drawing = drawingFromStroke(st);
      if (drawing) drawings.push(drawing);
    }
    if (drawings.length === 0) continue;
    const hidden = members.every((s) => s.hidden);
    const group: DrawingGroup = { id, name: id, drawings, ...groupWindow(members) };
    if (hidden) group.hidden = true;
    note.groups.push(group);
  }
  return note;
}

function strokeWindow(
  item: { start_tick?: number; end_tick?: number; hidden?: boolean },
  round: number,
  group?: string,
): Pick<Stroke, "round" | "start_tick" | "end_tick" | "group" | "hidden"> {
  return {
    round,
    ...(item.start_tick != null ? { start_tick: item.start_tick } : {}),
    ...(item.end_tick != null ? { end_tick: item.end_tick } : {}),
    ...(group ? { group } : {}),
    ...(item.hidden ? { hidden: true } : {}),
  };
}

function flattenDrawing(drawing: Drawing, meta: ReturnType<typeof strokeWindow>): Stroke {
  return { ...drawing, ...meta } as Stroke;
}

/** Flatten notes back to strokes for the current canvas/sidebar. */
export function flattenRoundNotes(rows: readonly RoundNote[]): Stroke[] {
  const out: Stroke[] = [];
  for (const row of rows) {
    out.push(...flattenNote(row.note, row.round));
  }
  return out;
}

export function flattenNote(note: Note, round: number): Stroke[] {
  const out: Stroke[] = [];
  for (const group of note.groups) {
    const meta = strokeWindow(group, round, group.id);
    for (const drawing of group.drawings) {
      out.push(flattenDrawing(drawing, meta));
    }
  }
  for (const drawing of note.drawings) {
    out.push(flattenDrawing(drawing, strokeWindow(drawing, round)));
  }
  for (const mark of note.bookmarks) {
    out.push({
      type: "bookmark",
      color: mark.color,
      text: mark.text,
      ...strokeWindow(mark, round),
    });
  }
  return out;
}
