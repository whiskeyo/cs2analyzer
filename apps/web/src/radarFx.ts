import type { Blind, Hurt } from "./types";

/** How long a hit ring stays on the victim. */
export const HIT_SECONDS = 0.45;
/** Shot traces linger this long (look-direction, not bullet physics). */
export const TRACER_SECONDS = 0.42;

/** Remaining flash time (seconds) per victim at `tick`. */
export function blindsAt(
  blinds: Blind[] | undefined,
  tick: number,
  tps: number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (!blinds || tps <= 0) return out;
  for (const b of blinds) {
    if (b.victim < 0 || b.duration <= 0) continue;
    const end = b.tick + b.duration * tps;
    if (tick < b.tick || tick >= end) continue;
    const left = (end - tick) / tps;
    const prev = out.get(b.victim) ?? 0;
    if (left > prev) out.set(b.victim, left);
  }
  return out;
}

/** Most recent hit in the pulse window, per victim. `age` is seconds since the hit. */
export function hitsAt(
  hurts: Hurt[] | undefined,
  tick: number,
  tps: number,
): Map<number, { age: number; damage: number }> {
  const out = new Map<number, { age: number; damage: number }>();
  if (!hurts || tps <= 0) return out;
  const window = HIT_SECONDS * tps;
  for (const h of hurts) {
    if (h.victim < 0 || h.damage <= 0) continue;
    const ageTicks = tick - h.tick;
    if (ageTicks < 0 || ageTicks > window) continue;
    const age = ageTicks / tps;
    const prev = out.get(h.victim);
    if (!prev || age < prev.age) out.set(h.victim, { age, damage: h.damage });
  }
  return out;
}

/** 1 just after pop, 0 when the smoke/molly expires. */
export function lingerRemaining(detonateTick: number, endTick: number, tick: number): number {
  const span = endTick - detonateTick;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (endTick - tick) / span));
}
