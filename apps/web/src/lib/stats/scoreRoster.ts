import { samplePlayers } from "@/lib/replay/sample";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import { liveScoreboardPlayers } from "./liveScore";

/** One Score row: a human who stood on a side, with side and money from the last connected sample. */
export interface ScoreRosterSlot {
  player: number;
  side: Side;
  money: number;
}

interface SlotPresence {
  tick: Uint32Array;
  ct: Uint8Array;
  money: Uint16Array;
  alive: Uint8Array;
  count: number;
}

const presenceCache = new WeakMap<Replay, SlotPresence[]>();

/**
 * Score tab roster. The live 5v5 filter hides anyone who is not connected at
 * `tick`, so the win panel (and a mid-match leave) drops real players. This
 * keeps every non-bot who was alive on T or CT in a counted round, using the
 * last sample where they were still connected. A leftover controller who is
 * still present stays on `liveScoreboardPlayers` so a sixth $0 pawn does not
 * return.
 */
export function scoreRoster(replay: Replay, tick: number): ScoreRosterSlot[] {
  const t = Math.floor(tick);
  const live = new Set(liveScoreboardPlayers(replay, t));
  const sampled = samplePlayers(replay, t);
  const presence = presenceOf(replay);
  const rounds = countedRounds(replay, t);
  const out: ScoreRosterSlot[] = [];
  for (let player = 0; player < replay.players.length; player++) {
    if (replay.players[player]?.is_bot) continue;
    const known = lastPresent(presence[player], t);
    if (!known) continue;
    const presentNow = sampled[player]?.present === true;
    // Still connected: trust the live filter so a sixth leftover stays off.
    // Gone: keep them when they were alive on a side in a counted round.
    if (presentNow) {
      if (!live.has(player)) continue;
    } else if (!stoodInCountedRound(presence[player], rounds, replay.rounds, t)) {
      continue;
    }
    out.push({ player, side: known.side, money: known.money });
  }
  return out;
}

function countedRounds(replay: Replay, tick: number): Round[] {
  return replay.rounds.filter(
    (round) => !round.is_knife && Math.min(round.freeze_end_tick, round.start_tick) <= tick,
  );
}

function stoodInCountedRound(
  slot: SlotPresence | undefined,
  counted: Round[],
  rounds: readonly Round[],
  tick: number,
): boolean {
  if (!slot) return false;
  for (const round of counted) {
    const windowEnd = roundWindowEnd(rounds, round);
    if (hasAliveBetween(slot, round.start_tick, Math.min(tick, windowEnd))) return true;
  }
  return false;
}

/** Last tick that still belongs to `round` (the sample before the next counted start). */
function roundWindowEnd(rounds: readonly Round[], round: Round): number {
  let next = Number.POSITIVE_INFINITY;
  for (const other of rounds) {
    if (other.start_tick > round.start_tick && other.start_tick < next) next = other.start_tick;
  }
  return Number.isFinite(next) ? next - 1 : Number.MAX_SAFE_INTEGER;
}

function hasAliveBetween(slot: SlotPresence, from: number, to: number): boolean {
  if (to < from || slot.count === 0) return false;
  let lo = 0;
  let hi = slot.count - 1;
  if (slot.tick[hi] < from) return false;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (slot.tick[mid] < from) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < slot.count && slot.tick[i] <= to; i++) {
    if (slot.alive[i]) return true;
  }
  return false;
}

function lastPresent(
  slot: SlotPresence | undefined,
  tick: number,
): { side: Side; money: number } | null {
  if (!slot || slot.count === 0 || slot.tick[0] > tick) return null;
  let lo = 0;
  let hi = slot.count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (slot.tick[mid] <= tick) lo = mid;
    else hi = mid - 1;
  }
  return { side: slot.ct[lo] ? "CT" : "T", money: slot.money[lo] };
}

function presenceOf(replay: Replay): SlotPresence[] {
  const cached = presenceCache.get(replay);
  if (cached) return cached;
  const built = buildPresence(replay);
  presenceCache.set(replay, built);
  return built;
}

function buildPresence(replay: Replay): SlotPresence[] {
  const pc = replay.ticks.playerCount;
  const frames = replay.ticks.frameCount;
  const n = Math.max(replay.players.length, pc);
  const counts = new Uint32Array(n);
  const flags = replay.ticks.flags;
  for (let frame = 0; frame < frames; frame++) {
    for (let player = 0; player < pc; player++) {
      if ((flags[frame * pc + player] & FLAG_PRESENT) !== 0) counts[player] += 1;
    }
  }
  const slots: SlotPresence[] = [];
  for (let player = 0; player < n; player++) {
    const count = counts[player];
    slots.push({
      tick: new Uint32Array(count),
      ct: new Uint8Array(count),
      money: new Uint16Array(count),
      alive: new Uint8Array(count),
      count: 0,
    });
  }
  const tickBuf = replay.ticks.ticks;
  const money = replay.ticks.money;
  for (let frame = 0; frame < frames; frame++) {
    const t = tickBuf[frame];
    for (let player = 0; player < pc; player++) {
      const flag = flags[frame * pc + player];
      if ((flag & FLAG_PRESENT) === 0) continue;
      const slot = slots[player];
      const i = slot.count;
      slot.count = i + 1;
      slot.tick[i] = t;
      slot.ct[i] = (flag & FLAG_CT) !== 0 ? 1 : 0;
      slot.money[i] = money?.[frame * pc + player] ?? 0;
      slot.alive[i] = (flag & FLAG_ALIVE) !== 0 ? 1 : 0;
    }
  }
  return slots;
}
