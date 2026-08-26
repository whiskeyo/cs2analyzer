import { DEFAULT_TICK_RATE, ROUND_TIMELINE_STEP_SECONDS } from "@/lib/shared/constants";
import type { Round } from "@/lib/replay/replayTypes";
import { formatClock } from "@/lib/weapons/weapons";

export function roundScrubRange(
  round: Round | undefined,
  rounds: Round[],
  fallback: { min: number; max: number },
): { min: number; max: number } {
  if (!round) return fallback;
  const i = rounds.findIndex((r) => r.start_tick === round.start_tick);
  const next = i >= 0 ? rounds[i + 1] : undefined;
  const min = round.start_tick;
  const max = next
    ? Math.max(min + 1, next.start_tick - 1)
    : Math.max(min + 1, round.end_tick, fallback.max);
  return { min, max };
}

export interface RoundTimelineMark {
  tick: number;
  label: string;
  /** 0–1 along the scrubber (round start → next round / demo end). */
  at: number;
}

/** 0:00 is freeze end, same origin as the HUD round clock. */
export function roundTimelineMarks(
  round: Round,
  tickRate: number,
  range: { min: number; max: number },
): RoundTimelineMark[] {
  const { min, max } = range;
  const span = max - min;
  if (span <= 0) return [];
  const rate = tickRate || DEFAULT_TICK_RATE;
  const origin = round.freeze_end_tick || round.start_tick;
  const step = Math.round(ROUND_TIMELINE_STEP_SECONDS * rate);
  if (step <= 0) return [];
  const out: RoundTimelineMark[] = [];
  for (let t = origin; t <= max; t += step) {
    if (t < min) continue;
    out.push({
      tick: t,
      label: formatClock((t - origin) / rate),
      at: (t - min) / span,
    });
  }
  return out;
}

export function freezeWidth(round: Round, range: { min: number; max: number }): number {
  const { min, max } = range;
  const span = max - min;
  if (span <= 0) return 0;
  const freeze = Math.min(max, Math.max(min, round.freeze_end_tick || min));
  return (freeze - min) / span;
}

export function markLabelShift(at: number): string {
  if (at <= 0.02) return "0";
  if (at >= 0.98) return "-100%";
  return "-50%";
}
