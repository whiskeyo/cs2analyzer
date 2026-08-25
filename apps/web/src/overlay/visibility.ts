import { DEFAULT_TICK_RATE, NOTE_MOMENT_MIN_SECONDS, NOTE_MOMENT_SECONDS } from "../constants";
import type { Round, Stroke } from "../types";

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

function stripWindow(st: Stroke): Stroke {
  const next = { ...st };
  delete next.start_tick;
  delete next.end_tick;
  return next;
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
