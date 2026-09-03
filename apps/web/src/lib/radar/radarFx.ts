import {
  FLASH_POP_SECONDS,
  FLASH_BURST_SECONDS,
  HE_BURST_SECONDS,
  HE_DECOY_SECONDS,
  KILL_LINE_MIN_LENGTH,
  MOLOTOV_SECONDS,
  SMOKE_SECONDS,
} from "@/lib/shared/constants";
import { currentRound, samplePlayer } from "@/lib/replay/sample";
import { isEnemyKill } from "@/lib/stats/stats";
import type {
  Blind,
  FireCell,
  GrenadeKind,
  GrenadeThrow,
  Hurt,
  Kill,
  Replay,
  Round,
} from "@/lib/replay/replayTypes";
import { isFireGrenade } from "@/lib/replay/replayTypes";
import type { SummaryFilter } from "@/lib/notes/types";

/** Must match `default_end` in assemble.rs. */
const NADE_SECS: Record<string, number> = {
  smoke: SMOKE_SECONDS,
  molotov: MOLOTOV_SECONDS,
  incendiary: MOLOTOV_SECONDS,
  decoy: HE_DECOY_SECONDS,
  he: HE_DECOY_SECONDS,
  flash: FLASH_POP_SECONDS,
};

export const NADE_COLORS: Record<GrenadeKind, string> = {
  smoke: "#c8d0d8",
  flash: "#f4e27a",
  he: "#9ecb3c",
  molotov: "#ff6a2a",
  incendiary: "#ff8a4a",
  decoy: "#9aa0a6",
};

/** Ticks the HE/flash pop ring stays after detonate. */
export function nadeBurstSpan(kind: GrenadeKind, tickRate: number): number {
  const secs = kind === "he" ? HE_BURST_SECONDS : kind === "flash" ? FLASH_BURST_SECONDS : 0;
  return Math.round(secs * (tickRate || 64));
}

/** Draw larger nades first so flashes sit on top of stacked smokes. */
const NADE_SUMMARY_ORDER: Record<GrenadeKind, number> = {
  smoke: 0,
  molotov: 1,
  incendiary: 1,
  he: 2,
  decoy: 3,
  flash: 4,
};

/** How long a hit ring stays on the victim. */
export const HIT_SECONDS = 0.45;
/** Shot traces linger this long (look-direction, not bullet physics). */
export const TRACER_SECONDS = 0.42;

/** Remaining seconds on a flash, for the radar label. */
export function formatBlindLeft(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

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
  if (isFireGrenade(g.kind)) return g.fires;
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

/** Landing / pop position: occupancy centroid at pop, else the last trajectory sample. */
export function nadeLandPos(g: GrenadeThrow): { x: number; y: number } | null {
  const cells = occupancyOf(g);
  if (cells && cells.length > 0) {
    const pop = nadePopTick(g);
    const atPop = cells.filter((c) => c.start_tick <= pop && c.end_tick >= pop);
    const use = atPop.length > 0 ? atPop : cells;
    let x = 0;
    let y = 0;
    for (const c of use) {
      x += c.x;
      y += c.y;
    }
    return { x: x / use.length, y: y / use.length };
  }
  const last = g.points[g.points.length - 1];
  if (!last) return null;
  return { x: last.x, y: last.y };
}

function throwerIsCt(replay: Replay, g: GrenadeThrow): boolean {
  const thrower = samplePlayer(replay, g.thrower, g.start_tick);
  if (thrower?.present) return thrower.ct;
  return replay.players[g.thrower]?.start_side === "CT";
}

function kindEnabled(filter: SummaryFilter, kind: GrenadeKind): boolean {
  if (isFireGrenade(kind)) return filter.kinds.molotov;
  return filter.kinds[kind];
}

export function nadesForSummary(replay: Replay, filter?: SummaryFilter): GrenadeThrow[] {
  const out = replay.grenades.filter((g) => {
    if (currentRound(replay, g.start_tick)?.is_knife) return false;
    if (filter && !kindEnabled(filter, g.kind)) return false;
    if (filter && (!filter.t || !filter.ct)) {
      const ct = throwerIsCt(replay, g);
      if (ct && !filter.ct) return false;
      if (!ct && !filter.t) return false;
    }
    return true;
  });
  out.sort((a, b) => NADE_SUMMARY_ORDER[a.kind] - NADE_SUMMARY_ORDER[b.kind]);
  return out;
}

export interface KillLineEnds {
  from: { x: number; y: number };
  to: { x: number; y: number };
  ct: boolean;
}

/** Attacker → victim in world XY at the kill tick. Null for suicides, teamkills, or missing pawns. */
export function killLineEnds(replay: Replay, k: Kill): KillLineEnds | null {
  if (k.attacker < 0 || k.victim < 0 || k.attacker === k.victim) return null;
  const attacker = samplePlayer(replay, k.attacker, k.tick);
  if (!attacker?.present) return null;
  const victim = samplePlayer(replay, k.victim, k.tick);
  const victimCt = victim?.present ? victim.ct : replay.players[k.victim]?.start_side === "CT";
  if (attacker.ct === victimCt) return null;
  const dx = attacker.x - k.x;
  const dy = attacker.y - k.y;
  if (dx * dx + dy * dy < KILL_LINE_MIN_LENGTH * KILL_LINE_MIN_LENGTH) return null;
  return { from: { x: attacker.x, y: attacker.y }, to: { x: k.x, y: k.y }, ct: attacker.ct };
}

/** First enemy frag of the round through `untilTick`. */
export function openingDuel(replay: Replay, round: Round, untilTick: number): Kill | null {
  if (round.is_knife) return null;
  let first: Kill | null = null;
  for (const k of replay.kills) {
    if (k.tick < round.freeze_end_tick || k.tick > round.end_tick || k.tick > untilTick) continue;
    if (!isEnemyKill(replay, k)) continue;
    if (!first || k.tick < first.tick) first = k;
  }
  return first;
}

/** Cap a segment at `maxLen` (same units as the points — world or screen). */
export function shortenSegment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxLen: number,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len <= maxLen || len === 0) return { from, to };
  const s = maxLen / len;
  return { from, to: { x: from.x + dx * s, y: from.y + dy * s } };
}
