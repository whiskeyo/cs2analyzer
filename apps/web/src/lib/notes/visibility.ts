import {
  DEFAULT_TICK_RATE,
  NOTE_MOMENT_MIN_SECONDS,
  NOTE_MOMENT_SECONDS,
} from "@/lib/shared/constants";
import type { Round } from "@/lib/replay/replayTypes";
import { cloneNote, earliestTimedTick as noteEarliestTick, overlayWindowOf } from "./note";
import type { NoteItemRef } from "./noteGroups";
import type { Note, RoundNote } from "./types";

export function overlayWindow(item: {
  start_tick?: number;
  end_tick?: number;
}): { start: number; end: number } | null {
  return overlayWindowOf(item);
}

export function itemWindow(note: Note, ref: NoteItemRef): { start: number; end: number } | null {
  if (ref.kind === "group") return overlayWindowOf(note.groups[ref.groupIndex] ?? {});
  if (ref.kind === "loose") return overlayWindowOf(note.drawings[ref.index] ?? {});
  return overlayWindowOf(note.bookmarks[ref.index] ?? {});
}

/** Hidden items stay off the radar. Timed ones only show inside the window. */
export function overlayVisible(
  item: { hidden?: boolean; start_tick?: number; end_tick?: number },
  tick: number,
): boolean {
  if (item.hidden) return false;
  const win = overlayWindowOf(item);
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

export function withMoment<T extends object>(
  item: T,
  moment: boolean,
  tick: number,
  roundEnd: number,
  tickRate: number,
): T & { start_tick?: number; end_tick?: number } {
  if (!moment) return item;
  return { ...item, ...momentBounds(tick, roundEnd, tickRate) };
}

export function noteRounds(notes: readonly RoundNote[]): Set<number> {
  return new Set(notes.map((row) => row.round));
}

export function earliestTimedTick(note: Note): number | undefined {
  return noteEarliestTick(note);
}

export function overlayJumpTick(note: Note, round: Round): number {
  return (noteEarliestTick(note) ?? round.freeze_end_tick) || round.start_tick;
}

export function momentLengthSeconds(note: Note, ref: NoteItemRef, tickRate: number): number | null {
  const win = itemWindow(note, ref);
  if (!win) return null;
  const rate = tickRate || DEFAULT_TICK_RATE;
  return (win.end - win.start) / rate;
}

function stampTarget(note: Note, ref: NoteItemRef, start: number, end: number): Note {
  const next = cloneNote(note);
  if (ref.kind === "group") {
    const group = next.groups[ref.groupIndex];
    if (!group) return note;
    next.groups[ref.groupIndex] = { ...group, start_tick: start, end_tick: end };
    return next;
  }
  if (ref.kind === "loose") {
    const drawing = next.drawings[ref.index];
    if (!drawing) return note;
    next.drawings[ref.index] = { ...drawing, start_tick: start, end_tick: end };
    return next;
  }
  const mark = next.bookmarks[ref.index];
  if (!mark) return note;
  next.bookmarks[ref.index] = { ...mark, start_tick: start, end_tick: end };
  return next;
}

function clearTarget(note: Note, ref: NoteItemRef): Note {
  const next = cloneNote(note);
  if (ref.kind === "group") {
    const group = next.groups[ref.groupIndex];
    if (!group) return note;
    const copy = { ...group };
    delete copy.start_tick;
    delete copy.end_tick;
    next.groups[ref.groupIndex] = copy;
    return next;
  }
  if (ref.kind === "loose") {
    const drawing = next.drawings[ref.index];
    if (!drawing) return note;
    const copy = { ...drawing };
    delete copy.start_tick;
    delete copy.end_tick;
    next.drawings[ref.index] = copy;
    return next;
  }
  const mark = next.bookmarks[ref.index];
  if (!mark) return note;
  const copy = { ...mark };
  delete copy.start_tick;
  delete copy.end_tick;
  next.bookmarks[ref.index] = copy;
  return next;
}

export function setMomentSeconds(
  note: Note,
  ref: NoteItemRef,
  seconds: number,
  tickRate: number,
  roundEnd: number,
  fallbackStart: number,
): Note {
  const rate = tickRate || DEFAULT_TICK_RATE;
  const start = itemWindow(note, ref)?.start ?? fallbackStart;
  const span = Math.max(Math.round(NOTE_MOMENT_MIN_SECONDS * rate), Math.round(seconds * rate));
  let end = start + span;
  if (roundEnd > 0) end = Math.min(end, roundEnd);
  end = Math.max(start, end);
  return stampTarget(note, ref, start, end);
}

export function clearMomentWindow(note: Note, ref: NoteItemRef): Note {
  return clearTarget(note, ref);
}

export function setMomentEdge(
  note: Note,
  ref: NoteItemRef,
  edge: "start" | "end",
  tick: number,
  roundStart: number,
  roundEnd: number,
  tickRate: number,
): Note {
  const rate = tickRate || DEFAULT_TICK_RATE;
  const fallback = Math.round(NOTE_MOMENT_SECONDS * rate);
  const minSpan = Math.round(NOTE_MOMENT_MIN_SECONDS * rate);
  const win = itemWindow(note, ref);
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
  return stampWindow(note, ref, start, end, roundStart, roundEnd, minSpan);
}

/** Set In or Out from a round-clock time (seconds after freeze). Can pass 60 for 1:00. */
export function setMomentClockEdge(
  note: Note,
  ref: NoteItemRef,
  edge: "start" | "end",
  seconds: number,
  origin: number,
  roundStart: number,
  roundEnd: number,
  tickRate: number,
): Note {
  if (!Number.isFinite(seconds)) return note;
  const rate = tickRate || DEFAULT_TICK_RATE;
  const fallback = Math.round(NOTE_MOMENT_SECONDS * rate);
  const minSpan = Math.round(NOTE_MOMENT_MIN_SECONDS * rate);
  const win = itemWindow(note, ref);
  let start = win?.start ?? origin;
  let end = win?.end ?? (roundEnd > origin ? roundEnd : origin + fallback);
  const tick = origin + Math.max(0, seconds) * rate;
  if (edge === "start") start = tick;
  else end = tick;
  return stampWindow(note, ref, start, end, roundStart, roundEnd, minSpan);
}

function stampWindow(
  note: Note,
  ref: NoteItemRef,
  start: number,
  end: number,
  roundStart: number,
  roundEnd: number,
  minSpan: number,
): Note {
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
  return stampTarget(note, ref, start, end);
}
