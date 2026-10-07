import { tickRate } from "@/lib/shared/constants";
import { interpolatePawn } from "@/lib/replay/interpolate";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_DEFUSING,
  FLAG_DUCKED,
  FLAG_PLANTING,
  FLAG_PRESENT,
  FLAG_SCOPED,
  type Replay,
  type Round,
} from "@/lib/replay/replayTypes";

export interface SampledPlayer {
  index: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  armor: number;
  present: boolean;
  alive: boolean;
  ducked: boolean;
  scoped: boolean;
  ct: boolean;
  planting: boolean;
  defusing: boolean;
  money: number;
  equip: number;
  gear: number;
  primary: number;
  secondary: number;
  active: number;
  clip: number;
  reserve: number;
}

function frameAt(ticks: Uint32Array, tick: number): { i: number; t: number } {
  if (ticks.length === 0) return { i: 0, t: 0 };
  let lo = 0;
  let hi = ticks.length - 1;
  if (tick <= ticks[0]) return { i: 0, t: 0 };
  if (tick >= ticks[hi]) return { i: hi, t: 0 };
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (ticks[mid] <= tick) lo = mid;
    else hi = mid;
  }
  const span = ticks[hi] - ticks[lo];
  const t = span === 0 ? 0 : (tick - ticks[lo]) / span;
  return { i: lo, t };
}

export function samplePlayer(replay: Replay, player: number, tick: number): SampledPlayer | null {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || buf.frameCount === 0 || player < 0 || player >= pc) return null;
  const { i, t } = frameAt(buf.ticks, tick);
  const j = Math.min(i + 1, buf.frameCount - 1);
  const a = i * pc + player;
  const b = j * pc + player;
  const blend = holdsKnifeFrame(replay, buf.ticks[i], buf.ticks[j]) ? 0 : t;
  const pose = interpolatePawn(
    {
      x: buf.x[a],
      y: buf.y[a],
      z: buf.z[a],
      yaw: buf.yaw[a],
      flags: buf.flags[a],
    },
    {
      x: buf.x[b],
      y: buf.y[b],
      z: buf.z[b],
      yaw: buf.yaw[b],
      flags: buf.flags[b],
    },
    blend,
    buf.ticks[j] - buf.ticks[i],
    tickRate(replay),
  );
  const flags = pose.snapped ? buf.flags[b] : buf.flags[a];
  return {
    index: player,
    x: pose.x,
    y: pose.y,
    z: pose.z,
    yaw: pose.yaw,
    health: buf.health[a],
    armor: buf.armor[a],
    present: (flags & FLAG_PRESENT) !== 0,
    alive: (flags & FLAG_ALIVE) !== 0,
    ducked: (flags & FLAG_DUCKED) !== 0,
    scoped: (flags & FLAG_SCOPED) !== 0,
    ct: (flags & FLAG_CT) !== 0,
    planting: (flags & FLAG_PLANTING) !== 0,
    defusing: (flags & FLAG_DEFUSING) !== 0,
    money: buf.money?.[a] ?? 0,
    equip: buf.equip?.[a] ?? 0,
    gear: buf.gear?.[a] ?? 0,
    primary: buf.primary?.[a] ?? 0,
    secondary: buf.secondary?.[a] ?? 0,
    active: buf.active?.[a] ?? 0,
    clip: buf.clip?.[a] ?? 0,
    reserve: buf.reserve?.[a] ?? 0,
  };
}

/**
 * Snapshots are read many times per frame — the radar, the HUD, the scoreboard
 * and most of `lib/match` all ask for the same tick — and every read walks all
 * 16 slots. Cache a few recent ticks per demo. Callers must treat the result as
 * read-only. The window covers the current tick plus a pass over the round
 * freezes, which is the widest pattern in `lib/match`.
 */
const SAMPLE_CACHE_TICKS = 64;
let sampleCache: {
  replay: Replay;
  byTick: Map<number, SampledPlayer[]>;
} | null = null;

export function samplePlayers(replay: Replay, tick: number): SampledPlayer[] {
  const pc = replay.ticks.playerCount;
  if (pc === 0 || replay.ticks.frameCount === 0) return [];
  if (!sampleCache || sampleCache.replay !== replay) {
    sampleCache = { replay, byTick: new Map() };
  }
  const hit = sampleCache.byTick.get(tick);
  if (hit) return hit;
  const out: SampledPlayer[] = [];
  for (let p = 0; p < pc; p++) {
    const sampled = samplePlayer(replay, p, tick);
    if (sampled) out.push(sampled);
  }
  const { byTick } = sampleCache;
  if (byTick.size >= SAMPLE_CACHE_TICKS) {
    const oldest = byTick.keys().next().value;
    if (oldest !== undefined) byTick.delete(oldest);
  }
  byTick.set(tick, out);
  return out;
}

/**
 * Last round that has started at `tick` — not the round containing `tick` by
 * `end_tick`, so the gap after a round still belongs to it. Rounds come out of
 * the parser ordered by `start_tick`, so this binary searches.
 */
export function currentRound(replay: Replay, tick: number) {
  const rounds = replay.rounds;
  if (rounds.length === 0) return null;
  let lo = 0;
  let hi = rounds.length - 1;
  if (tick < rounds[0].start_tick) return rounds[0];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rounds[mid].start_tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return rounds[lo];
}

/**
 * Last tick a grenade or fire still belongs to `round`.
 *
 * The window is `[round.start_tick, next round start)`. A molotov that lands
 * after `end_tick` stays in the round that was just played until the next
 * freeze. The last round has no following start, so the window stays open.
 */
export function grenadeRoundLastTick(rounds: readonly Round[], round: Round): number {
  let next = Number.POSITIVE_INFINITY;
  for (const other of rounds) {
    if (other.start_tick > round.start_tick && other.start_tick < next) {
      next = other.start_tick;
    }
  }
  return Number.isFinite(next) ? next - 1 : Number.MAX_SAFE_INTEGER;
}

/**
 * FACEIT records no player frames between the last knife sample and the first
 * round-1 sample. Blending that hole slides pawns through ticks that have no
 * snapshot. The span is those two frame ticks. HLTV and Premier keep a normal
 * stride across the same boundary, so this stays null.
 */
export function knifeSideChoiceGap(replay: Replay): { from: number; to: number } | null {
  const ticks = replay.ticks.ticks;
  if (ticks.length < 2) return null;
  const knife = replay.rounds.find((round) => round.is_knife);
  if (!knife) return null;
  const r1 =
    replay.rounds.find((round) => !round.is_knife && round.number === 1) ??
    replay.rounds.find((round) => !round.is_knife && round.start_tick > knife.start_tick);
  if (!r1) return null;

  const last = lastFrameAtOrBefore(ticks, knife.end_tick);
  if (last < 0 || last + 1 >= ticks.length) return null;
  const from = ticks[last];
  const to = ticks[last + 1];
  if (from === undefined || to === undefined) return null;
  if (from < knife.start_tick || from > knife.end_tick) return null;
  if (currentRound(replay, to) !== r1) return null;
  const stride = replay.header.tick_stride > 0 ? replay.header.tick_stride : 1;
  if (to - from <= stride) return null;
  return { from, to };
}

let knifeGapCache: { replay: Replay; gap: { from: number; to: number } | null } | null = null;

function cachedKnifeSideChoiceGap(replay: Replay): { from: number; to: number } | null {
  if (knifeGapCache?.replay === replay) return knifeGapCache.gap;
  const gap = knifeSideChoiceGap(replay);
  knifeGapCache = { replay, gap };
  return gap;
}

/** True when `earlier` and `later` are the two frames of the knife side-choice hole. */
function holdsKnifeFrame(replay: Replay, earlier: number, later: number): boolean {
  const gap = cachedKnifeSideChoiceGap(replay);
  return gap != null && earlier === gap.from && later === gap.to;
}

function lastFrameAtOrBefore(ticks: Uint32Array, tick: number): number {
  if (ticks.length === 0 || tick < ticks[0]) return -1;
  return frameAt(ticks, tick).i;
}

/**
 * HUD plant/defuse clocks call this every published tick while the flag is
 * set. One slot is enough: liveSituation only walks the active clock's flag.
 */
let flagStartCache: {
  replay: Replay;
  player: number;
  flag: number;
  fromTick: number;
  start: number;
  startFrame: number;
  endFrame: number;
} | null = null;

function cachedFlagStart(
  replay: Replay,
  player: number,
  flag: number,
  fromTick: number,
  end: number,
  pc: number,
  flags: Uint8Array,
): number | null {
  const cached = flagStartCache;
  if (
    !cached ||
    cached.replay !== replay ||
    cached.player !== player ||
    cached.flag !== flag ||
    cached.fromTick !== fromTick
  ) {
    return null;
  }
  if (end < cached.startFrame) return null;
  if (end <= cached.endFrame) return cached.start;
  for (let f = cached.endFrame + 1; f <= end; f++) {
    if ((flags[f * pc + player] & flag) === 0) return null;
  }
  cached.endFrame = end;
  return cached.start;
}

/**
 * Tick where the player's latest run of `flag` began, if that run still
 * covers `toTick`. Frames before `fromTick` only seed whether the run was
 * already on when the window opened (sparse GOTV samples).
 *
 * Binary-searches `ticks[]` for `toTick`, then walks the short on-run
 * backward (plant/defuse last a few seconds, not the whole GOTV).
 */
export function trailingFlagStart(
  replay: Replay,
  player: number,
  flag: number,
  fromTick: number,
  toTick: number,
): number | null {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player < 0 || player >= pc || buf.frameCount === 0) return null;
  const end = lastFrameAtOrBefore(buf.ticks, toTick);
  if (end < 0) return null;
  if ((buf.flags[end * pc + player] & flag) === 0) return null;

  const hit = cachedFlagStart(replay, player, flag, fromTick, end, pc, buf.flags);
  if (hit != null) return hit;

  let startFrame = end;
  while (startFrame > 0) {
    const prev = startFrame - 1;
    if ((buf.flags[prev * pc + player] & flag) === 0) break;
    startFrame = prev;
  }
  const start = Math.max(buf.ticks[startFrame], fromTick);
  flagStartCache = {
    replay,
    player,
    flag,
    fromTick,
    start,
    startFrame,
    endFrame: end,
  };
  return start;
}

export function sampleTrail(
  replay: Replay,
  player: number,
  tick: number,
  lookback: number,
): { x: number; y: number }[] {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player >= pc) return [];
  const from = tick - lookback;
  const out: { x: number; y: number }[] = [];
  for (let f = 0; f < buf.frameCount; f++) {
    const t = buf.ticks[f];
    if (t < from || t > tick) continue;
    const i = f * pc + player;
    if ((buf.flags[i] & FLAG_PRESENT) === 0) continue;
    out.push({ x: buf.x[i], y: buf.y[i] });
  }
  return out;
}
