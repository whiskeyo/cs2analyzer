import type { Drawing, DrawingGroup, Note, RoundNote } from "./types";

export function emptyNote(): Note {
  return { groups: [], drawings: [], pieces: [], bookmarks: [] };
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

export function drawingWithWindow(
  drawing: Drawing,
  src: { hidden?: boolean; start_tick?: number; end_tick?: number },
): Drawing {
  const next: Drawing = { ...drawing };
  delete next.hidden;
  delete next.start_tick;
  delete next.end_tick;
  if (src.hidden) next.hidden = true;
  const win = overlayWindowOf(src);
  if (win) {
    next.start_tick = win.start;
    next.end_tick = win.end;
  }
  return next;
}

function groupDrawings(group: DrawingGroup, tick: number | null): Drawing[] {
  if (group.hidden) return [];
  if (!windowVisible(group, tick)) return [];
  return group.drawings;
}

function ungroupedDrawing(drawing: Drawing, tick: number | null): Drawing | null {
  if (drawing.hidden) return null;
  if (!windowVisible(drawing, tick)) return null;
  return drawing;
}

/** Drawings to paint. Analyzer passes the current tick; playbook passes `null`. */
export function visibleDrawings(note: Note, tick: number | null): Drawing[] {
  const out: Drawing[] = [];
  for (const group of note.groups) {
    out.push(...groupDrawings(group, tick));
  }
  for (const drawing of note.drawings) {
    const visible = ungroupedDrawing(drawing, tick);
    if (visible) out.push(visible);
  }
  return out;
}

/** Drawings + grouped drawings + bookmarks — saved-notes list count. */
export function noteDrawingCount(notes: readonly RoundNote[]): number {
  let count = 0;
  for (const row of notes) {
    count += row.note.drawings.length + row.note.bookmarks.length;
    for (const group of row.note.groups) count += group.drawings.length;
  }
  return count;
}

export function earliestTimedTick(note: Note): number | undefined {
  let min: number | undefined;
  const consider = (start: number | undefined) => {
    if (start == null) return;
    if (min == null || start < min) min = start;
  };
  for (const group of note.groups) consider(group.start_tick);
  for (const drawing of note.drawings) consider(drawing.start_tick);
  for (const mark of note.bookmarks) consider(mark.start_tick ?? mark.tick);
  return min;
}
