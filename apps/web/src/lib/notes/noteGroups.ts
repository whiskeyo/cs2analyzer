import { NOTE_GROUP_NAME_MAX, NOTE_LAYER_NAME } from "@/lib/shared/constants";
import { cloneNote, drawingWithWindow, overlayWindowOf } from "./note";
import type { Drawing, DrawingGroup, Note } from "./types";

export type NoteItemRef =
  | { kind: "loose"; index: number }
  | { kind: "group"; groupIndex: number; drawingIndex: number }
  | { kind: "bookmark"; index: number };

export type NoteDropDest =
  { kind: "ungroup" } | { kind: "new-group" } | { kind: "into"; groupIndex: number };

function groupSerial(id: string): number {
  const auto = /^g(\d+)$/.exec(id);
  if (auto) return Number(auto[1]);
  const named = /^Group (\d+)$/.exec(id);
  if (named) return Number(named[1]);
  return 0;
}

export function nextGroupId(note: Note): string {
  let max = 0;
  for (const group of note.groups) {
    max = Math.max(max, groupSerial(group.id), groupSerial(group.name));
  }
  return `Group ${max + 1}`;
}

export function nextLayerName(note: Note): string {
  const used = new Set(note.groups.map((g) => g.name));
  if (!used.has(NOTE_LAYER_NAME)) return NOTE_LAYER_NAME;
  let n = 2;
  while (used.has(`${NOTE_LAYER_NAME} ${n}`)) n += 1;
  return `${NOTE_LAYER_NAME} ${n}`;
}

export function isPenOrArrow(drawing: Drawing): boolean {
  return drawing.type === "pen" || drawing.type === "arrow";
}

function drawingAt(note: Note, ref: NoteItemRef): Drawing | null {
  if (ref.kind === "loose") return note.drawings[ref.index] ?? null;
  if (ref.kind === "group") {
    return note.groups[ref.groupIndex]?.drawings[ref.drawingIndex] ?? null;
  }
  return null;
}

function refKey(ref: NoteItemRef): string {
  if (ref.kind === "group") return `g:${ref.groupIndex}:${ref.drawingIndex}`;
  return `${ref.kind}:${ref.index}`;
}

function uniqueRefs(refs: readonly NoteItemRef[]): NoteItemRef[] {
  const seen = new Set<string>();
  const out: NoteItemRef[] = [];
  for (const ref of refs) {
    const key = refKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export function canGroup(note: Note, refs: readonly NoteItemRef[]): boolean {
  return uniqueRefs(refs).filter((ref) => drawingAt(note, ref) != null).length >= 2;
}

function takeDrawing(note: Note, ref: NoteItemRef): Drawing | null {
  if (ref.kind === "loose") {
    const item = note.drawings[ref.index];
    if (!item) return null;
    note.drawings.splice(ref.index, 1);
    return item;
  }
  if (ref.kind === "bookmark") return null;
  const group = note.groups[ref.groupIndex];
  const drawing = group?.drawings[ref.drawingIndex];
  if (!group || !drawing) return null;
  group.drawings.splice(ref.drawingIndex, 1);
  return drawingWithWindow(drawing, group);
}

function dissolveSmallGroups(note: Note): void {
  const keep: DrawingGroup[] = [];
  for (const group of note.groups) {
    if (group.drawings.length >= 2) {
      keep.push(group);
      continue;
    }
    for (const drawing of group.drawings) {
      note.drawings.push(drawingWithWindow(drawing, group));
    }
  }
  note.groups = keep;
}

function sortRefsForRemoval(refs: readonly NoteItemRef[]): NoteItemRef[] {
  return uniqueRefs(refs).sort((a, b) => {
    if (a.kind === "group" && b.kind === "group") {
      if (a.groupIndex !== b.groupIndex) return b.groupIndex - a.groupIndex;
      return b.drawingIndex - a.drawingIndex;
    }
    if (a.kind === "loose" && b.kind === "loose") return b.index - a.index;
    if (a.kind === "bookmark" && b.kind === "bookmark") return b.index - a.index;
    if (a.kind === "loose") return -1;
    if (b.kind === "loose") return 1;
    if (a.kind === "bookmark") return 1;
    if (b.kind === "bookmark") return -1;
    return 0;
  });
}

function unionWindow(items: Drawing[]): Pick<DrawingGroup, "start_tick" | "end_tick"> {
  const timed = items.filter((s) => s.start_tick != null);
  if (timed.length === 0) return {};
  const start = Math.min(...timed.map((s) => s.start_tick as number));
  const end = Math.max(...timed.map((s) => s.end_tick ?? (s.start_tick as number)));
  return { start_tick: start, end_tick: end };
}

function takeItems(note: Note, refs: readonly NoteItemRef[]): Drawing[] {
  const items: Drawing[] = [];
  for (const ref of sortRefsForRemoval(refs)) {
    const item = takeDrawing(note, ref);
    if (item) items.push(item);
  }
  dissolveSmallGroups(note);
  return items.reverse();
}

export function groupItems(note: Note, refs: readonly NoteItemRef[]): Note {
  if (!canGroup(note, refs)) return note;
  const next = cloneNote(note);
  const items = takeItems(next, refs);
  if (items.length < 2) return note;
  const id = nextGroupId(next);
  next.groups.push({
    id,
    name: id,
    drawings: items,
    ...unionWindow(items),
  });
  return next;
}

export function ungroup(note: Note, groupIndex: number): Note {
  const group = note.groups[groupIndex];
  if (!group) return note;
  const next = cloneNote(note);
  const items: Drawing[] = group.drawings.map((drawing) => drawingWithWindow(drawing, group));
  next.groups.splice(groupIndex, 1);
  next.drawings.push(...items);
  return next;
}

export function renameGroup(note: Note, groupIndex: number, name: string): Note {
  const group = note.groups[groupIndex];
  const nextName = name.trim().slice(0, NOTE_GROUP_NAME_MAX);
  if (!group || nextName === "" || nextName === group.name) return note;
  const next = cloneNote(note);
  next.groups[groupIndex] = { ...group, id: nextName, name: nextName };
  return next;
}

export function removeItems(note: Note, refs: readonly NoteItemRef[]): Note {
  const next = cloneNote(note);
  for (const ref of sortRefsForRemoval(refs)) {
    if (ref.kind === "bookmark") {
      if (next.bookmarks[ref.index]) next.bookmarks.splice(ref.index, 1);
      continue;
    }
    takeDrawing(next, ref);
  }
  dissolveSmallGroups(next);
  return next;
}

export function setItemsHidden(note: Note, refs: readonly NoteItemRef[], hidden: boolean): Note {
  const next = cloneNote(note);
  for (const ref of uniqueRefs(refs)) {
    if (ref.kind === "loose") {
      const item = next.drawings[ref.index];
      if (!item) continue;
      if (hidden) item.hidden = true;
      else delete item.hidden;
    } else if (ref.kind === "group") {
      const group = next.groups[ref.groupIndex];
      if (!group) continue;
      if (hidden) group.hidden = true;
      else delete group.hidden;
    } else {
      const mark = next.bookmarks[ref.index];
      if (!mark) continue;
      if (hidden) mark.hidden = true;
      else delete mark.hidden;
    }
  }
  return next;
}

export function assignToGroup(
  note: Note,
  refs: readonly NoteItemRef[],
  groupIndex: number | null,
): Note {
  const destId = groupIndex != null ? note.groups[groupIndex]?.id : null;
  if (groupIndex != null && destId == null) return note;
  const next = cloneNote(note);
  const items = takeItems(next, refs);
  if (items.length === 0) return note;
  if (destId == null) {
    next.drawings.push(...items);
    return next;
  }
  const dest = next.groups.find((g) => g.id === destId);
  if (!dest) {
    next.drawings.push(...items);
    return next;
  }
  dest.drawings.push(...items);
  const extra = unionWindow(items);
  const win = overlayWindowOf(dest) ?? overlayWindowOf(extra);
  if (win) {
    dest.start_tick = win.start;
    dest.end_tick = win.end;
  }
  return next;
}

function wholeGroupSelected(note: Note, refs: readonly NoteItemRef[]): boolean {
  const unique = uniqueRefs(refs);
  if (unique[0]?.kind !== "group") return false;
  const gi = unique[0].groupIndex;
  if (unique.some((r) => r.kind !== "group" || r.groupIndex !== gi)) return false;
  const group = note.groups[gi];
  return group != null && unique.length === group.drawings.length;
}

export function dropItems(note: Note, refs: readonly NoteItemRef[], dest: NoteDropDest): Note {
  const unique = uniqueRefs(refs).filter((ref) => drawingAt(note, ref) != null);
  if (unique.length === 0) return note;
  if (dest.kind === "ungroup") return assignToGroup(note, unique, null);
  if (dest.kind === "into") return assignToGroup(note, unique, dest.groupIndex);
  if (unique.length < 2) return note;
  if (wholeGroupSelected(note, unique)) return note;
  return groupItems(note, unique);
}

export function squashLooseDrawings(note: Note): Note {
  const refs: NoteItemRef[] = note.drawings.flatMap((item, index) =>
    isPenOrArrow(item) ? [{ kind: "loose" as const, index }] : [],
  );
  if (refs.length < 2) return note;
  const grouped = groupItems(note, refs);
  if (grouped === note) return note;
  const last = grouped.groups.length - 1;
  if (last < 0) return grouped;
  return renameGroup(grouped, last, nextLayerName(note));
}
