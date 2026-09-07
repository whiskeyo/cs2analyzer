import type { Drawing, DrawingGroup, LooseItem, Note } from "./types";

export function emptyNote(): Note {
  return { groups: [], loose: [], pieces: [], bookmarks: [] };
}

export function cloneNote(note: Note): Note {
  return structuredClone(note);
}

export function overlayWindowOf(item: {
  start_tick?: number;
  end_tick?: number;
}): { start: number; end: number } | null {
  if (item.start_tick == null) return null;
  const end = item.end_tick ?? item.start_tick;
  return { start: item.start_tick, end };
}

/** True when `tick` is inside the window, or when there is no window. `tick === null` skips the clock (playbook). */
export function windowVisible(
  item: { start_tick?: number; end_tick?: number },
  tick: number | null,
): boolean {
  if (tick == null) return true;
  const win = overlayWindowOf(item);
  if (!win) return true;
  return tick >= win.start && tick <= win.end;
}

function groupDrawings(group: DrawingGroup, tick: number | null): Drawing[] {
  if (group.hidden) return [];
  if (!windowVisible(group, tick)) return [];
  return group.drawings;
}

function looseDrawing(item: LooseItem, tick: number | null): Drawing | null {
  if (item.hidden) return null;
  if (!windowVisible(item, tick)) return null;
  return item.drawing;
}

/** Drawings to paint. Analyzer passes the current tick; playbook passes `null`. */
export function visibleDrawings(note: Note, tick: number | null): Drawing[] {
  const out: Drawing[] = [];
  for (const group of note.groups) {
    out.push(...groupDrawings(group, tick));
  }
  for (const item of note.loose) {
    const drawing = looseDrawing(item, tick);
    if (drawing) out.push(drawing);
  }
  return out;
}

export function earliestTimedTick(note: Note): number | undefined {
  let min: number | undefined;
  const consider = (start: number | undefined) => {
    if (start == null) return;
    if (min == null || start < min) min = start;
  };
  for (const group of note.groups) consider(group.start_tick);
  for (const item of note.loose) consider(item.start_tick);
  for (const mark of note.bookmarks) consider(mark.start_tick ?? mark.tick);
  return min;
}
