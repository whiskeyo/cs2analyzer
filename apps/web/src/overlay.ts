import { NOTE_MOMENT_SECONDS } from "./constants";
import type { Round, Stroke } from "./types";

export type TextStroke = Extract<Stroke, { type: "text" }>;

/** Round-scoped overlays show for the whole round; timed ones only inside the window. */
export function overlayVisible(st: Stroke, tick: number, round: number): boolean {
  if (st.round !== round) return false;
  if (st.start_tick == null && st.end_tick == null) return true;
  const start = st.start_tick ?? Number.NEGATIVE_INFINITY;
  const end = st.end_tick ?? Number.POSITIVE_INFINITY;
  return tick >= start && tick <= end;
}

export function momentBounds(
  tick: number,
  roundEnd: number,
  tickRate: number,
): { start_tick: number; end_tick: number } {
  const span = Math.round(NOTE_MOMENT_SECONDS * (tickRate || 64));
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
