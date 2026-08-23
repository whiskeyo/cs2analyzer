import { FLASH_POP_SECONDS, HE_DECOY_SECONDS, MOLOTOV_SECONDS, SMOKE_SECONDS } from "./constants";
import type { Blind, FireCell, GrenadeThrow, Hurt } from "./types";

/** Must match `default_end` in assemble.rs. */
const NADE_SECS: Record<string, number> = {
  smoke: SMOKE_SECONDS,
  molotov: MOLOTOV_SECONDS,
  decoy: HE_DECOY_SECONDS,
  he: HE_DECOY_SECONDS,
  flash: FLASH_POP_SECONDS,
};

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

/** Inferno cells still burning at `tick`. */
export function firesAt(fires: FireCell[] | undefined, tick: number): FireCell[] {
  if (!fires || fires.length === 0) return [];
  return fires.filter((c) => tick >= c.start_tick && tick <= c.end_tick);
}

function occupancyOf(g: GrenadeThrow): FireCell[] | undefined {
  if (g.kind === "molotov") return g.fires;
  if (g.kind === "smoke") return g.voxels;
  return undefined;
}

/** Detonate tick, or first occupancy sample when the projectile entity lingered. */
export function nadePopTick(g: GrenadeThrow): number {
  let pop = g.detonate_tick;
  const cells = occupancyOf(g);
  if (!cells) return pop;
  for (const c of cells) {
    if (c.start_tick < pop) pop = c.start_tick;
  }
  return pop;
}

/**
 * Last tick the nade should stay on the radar.
 * Caps a stretched `end_tick` (entity lingered in GOTV) and shortens when occupancy dies early.
 */
export function nadeVisibleEnd(g: GrenadeThrow, tickRate: number, roundEnd?: number): number {
  const rate = tickRate || 64;
  const secs = NADE_SECS[g.kind] ?? 0.5;
  const pop = nadePopTick(g);
  let end = pop + Math.round(secs * rate);
  if (g.end_tick > 0) end = Math.min(end, g.end_tick);
  const cells = occupancyOf(g);
  if (cells && cells.length > 0) {
    let last = 0;
    for (const c of cells) {
      if (c.end_tick > last) last = c.end_tick;
    }
    if (last > 0 && last < end) end = last;
  }
  if (roundEnd != null && roundEnd > 0) end = Math.min(end, roundEnd);
  return end;
}
