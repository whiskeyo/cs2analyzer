import {
  BOMB_SECONDS,
  DEFUSE_WITH_KIT_SECONDS,
  DEFUSE_WITHOUT_KIT_SECONDS,
  PLANT_SECONDS,
  tickRate,
} from "@/lib/shared/constants";
import { currentRound, samplePlayers, trailingFlagStart } from "@/lib/replay/sample";
import {
  FLAG_DEFUSING,
  FLAG_PLANTING,
  GEAR_C4,
  GEAR_DEFUSER,
  type BombEvent,
  type Replay,
  type Round,
  type Side,
} from "@/lib/replay/replayTypes";

export interface LiveSituation {
  ctAlive: number;
  tAlive: number;
  clutch: { player: number; vs: number; side: Side } | null;
  bomb: { remaining: number; planted: boolean } | null;
  defuse: { remaining: number; haskit: boolean } | null;
  plant: { remaining: number } | null;
  freeze: number | null;
  roundWin: { winner: Side; reason: number } | null;
}

export function liveSituation(replay: Replay, tick: number): LiveSituation {
  const players = samplePlayers(replay, tick);
  const ctAlive = players.filter((p) => p.present && p.alive && p.ct).length;
  const tAlive = players.filter((p) => p.present && p.alive && !p.ct).length;
  let clutch: LiveSituation["clutch"] = null;
  if (ctAlive === 1 && tAlive >= 1) {
    const p = players.find((x) => x.present && x.alive && x.ct);
    if (p) {
      clutch = { player: p.index, vs: tAlive, side: "CT" };
    }
  } else if (tAlive === 1 && ctAlive >= 1) {
    const p = players.find((x) => x.present && x.alive && !x.ct);
    if (p) {
      clutch = { player: p.index, vs: ctAlive, side: "T" };
    }
  }

  const bomb = bombClock(replay, tick, ctAlive, players.filter((p) => p.present && p.ct).length);

  return {
    ctAlive,
    tAlive,
    clutch,
    bomb,
    defuse: defuseClock(replay, tick),
    plant: plantClock(replay, tick),
    freeze: freezeRemaining(replay, tick),
    roundWin: roundWinBanner(replay, tick),
  };
}

export type BombView =
  | { state: "none" }
  | { state: "planted"; remaining: number; x: number; y: number }
  | { state: "loose"; x: number; y: number }
  | { state: "carried"; player: number };

/** Planted C4 while it is still in play. Stops on defuse/explode, 40s, round over, or CT wipe. */
export function activeBomb(
  replay: Replay,
  tick: number,
): { remaining: number; planted: boolean; x: number; y: number } | null {
  const view = bombView(replay, tick);
  if (view.state !== "planted") {
    return null;
  }
  return { remaining: view.remaining, planted: true, x: view.x, y: view.y };
}

/**
 * C4 at tick `t`: planted (fuse), carried (`GEAR_C4`), loose (last drop), or none.
 * Pickup/drop events locate a loose pack; the carrier is the gear bit.
 */
export function bombView(replay: Replay, tick: number): BombView {
  const planted = plantedBombAt(replay, tick);
  if (planted) {
    return { state: "planted", ...planted };
  }
  const players = samplePlayers(replay, tick);
  const carrier = players.find((p) => p.present && (p.gear & GEAR_C4) !== 0);
  if (carrier) {
    return { state: "carried", player: carrier.index };
  }
  const loose = lastLooseBomb(replay, tick);
  if (loose) {
    return { state: "loose", x: loose.x, y: loose.y };
  }
  return { state: "none" };
}

function plantedBombAt(
  replay: Replay,
  tick: number,
): { remaining: number; x: number; y: number } | null {
  const players = samplePlayers(replay, tick);
  const ct = players.filter((p) => p.present && p.ct);
  const clock = bombClock(replay, tick, ct.filter((p) => p.alive).length, ct.length);
  if (!clock) {
    return null;
  }
  const round = currentRound(replay, tick);
  if (!round) {
    return null;
  }
  let plant: { x: number; y: number } | null = null;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) {
      continue;
    }
    if (e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "planted") {
      const pos = plantedBombPos(replay, e);
      plant = { x: pos.x, y: pos.y };
    }
    if (e.kind === "defused" || e.kind === "exploded") {
      plant = null;
    }
  }
  if (!plant) {
    return null;
  }
  return { remaining: clock.remaining, ...plant };
}

function lastLooseBomb(replay: Replay, tick: number): { x: number; y: number } | null {
  const round = currentRound(replay, tick);
  if (!round) {
    return null;
  }
  let pos: { x: number; y: number } | null = null;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) {
      continue;
    }
    if (e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "dropped") {
      const p = plantedBombPos(replay, e);
      pos = { x: p.x, y: p.y };
    } else if (
      e.kind === "pickup" ||
      e.kind === "planted" ||
      e.kind === "defused" ||
      e.kind === "exploded"
    ) {
      pos = null;
    }
  }
  return pos;
}

/** World position of a plant. GOTV often omits pawn XYZ; fall back to the planter. */
export function plantedBombPos(replay: Replay, e: BombEvent): { x: number; y: number; z: number } {
  if (e.x !== 0 || e.y !== 0) {
    return { x: e.x, y: e.y, z: e.z };
  }
  if (e.player < 0) {
    return { x: e.x, y: e.y, z: e.z };
  }
  const p = samplePlayers(replay, e.tick)[e.player];
  if (p?.present) {
    return { x: p.x, y: p.y, z: p.z };
  }
  return { x: e.x, y: e.y, z: e.z };
}

function bombClock(
  replay: Replay,
  tick: number,
  ctAlive: number,
  ctPresent: number,
): { remaining: number; planted: boolean } | null {
  const tps = tickRate(replay);
  const round = currentRound(replay, tick);
  if (!round || tick > round.end_tick) {
    return null;
  }
  const next = replay.rounds.find((r) => r.start_tick > round.start_tick);
  if (next && tick >= next.start_tick) {
    return null;
  }

  let plantTick = -1;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) {
      continue;
    }
    if (e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "planted") {
      plantTick = e.tick;
    }
    if ((e.kind === "defused" || e.kind === "exploded") && e.tick >= plantTick) {
      plantTick = -1;
    }
  }
  // CS2: bomb clock is gone as soon as CTs are eliminated (T already won).
  if (ctPresent > 0 && ctAlive === 0) {
    plantTick = -1;
  }
  if (plantTick < 0) {
    return null;
  }
  const remaining = BOMB_SECONDS - (tick - plantTick) / tps;
  if (remaining <= 0) {
    return null;
  }
  return { remaining, planted: true };
}

/** Seconds left in freeze. Null once live play has started. */
export function freezeRemaining(replay: Replay, tick: number): number | null {
  const round = currentRound(replay, tick);
  if (!round || tick >= round.freeze_end_tick) {
    return null;
  }
  const tps = tickRate(replay);
  return Math.max(0, (round.freeze_end_tick - tick) / tps);
}

/**
 * Winner chip: after the round ends, or during the next freeze so the result
 * stays on screen through the post-round / buy period.
 */
export function roundWinBanner(
  replay: Replay,
  tick: number,
): { winner: Side; reason: number } | null {
  const round = currentRound(replay, tick);
  if (!round) {
    return null;
  }
  if (tick >= round.end_tick && round.winner) {
    return { winner: round.winner, reason: round.win_reason };
  }
  if (tick < round.freeze_end_tick) {
    let prev: Round | null = null;
    for (const r of replay.rounds) {
      if (r.start_tick < round.start_tick) {
        prev = r;
      }
    }
    if (prev?.winner) {
      return { winner: prev.winner, reason: prev.win_reason };
    }
  }
  return null;
}

/**
 * Active defuse. A kit is 5s and no kit is 10s; each new begin restarts from
 * full time. When this plant recorded a begin, abort, or defused event, those
 * events own the clock: flags cannot start one again after an abort. GOTV may
 * omit `abort_defuse`, so once a begin is in effect the clock also stops when
 * no alive CT still has `FLAG_DEFUSING`, after two tick strides of slack.
 * The event slot is not a column index. Flags are the fallback only when the
 * plant has no defuse event, and only for a CT. A kill of the begin player
 * and an explosion end the clock too.
 */
export function defuseClock(
  replay: Replay,
  tick: number,
): { remaining: number; haskit: boolean } | null {
  const tps = tickRate(replay);
  const round = currentRound(replay, tick);
  if (!round || tick > round.end_tick) {
    return null;
  }

  const plantTick = activePlantTick(replay, round, tick);
  if (plantTick < 0) {
    return null;
  }

  const trackedByEvents = plantHasDefuseEvents(replay, round, plantTick);
  const begin = trackedByEvents
    ? defuseBeginFromEvents(replay, round, plantTick, tick)
    : defuseBeginFromFlags(replay, tick, plantTick);
  if (!begin || defuserDown(replay, tick, begin)) {
    return null;
  }
  if (trackedByEvents && defuseFlagReleased(replay, tick, begin)) {
    return null;
  }

  const haskit = defuseHasKit(replay, tick, begin);
  const duration = haskit ? DEFUSE_WITH_KIT_SECONDS : DEFUSE_WITHOUT_KIT_SECONDS;
  const remaining = duration - (tick - begin.tick) / tps;
  if (remaining < -0.25) {
    return null;
  }
  return { remaining: Math.max(0, remaining), haskit };
}

type DefuseBegin = { tick: number; haskit: boolean; player: number };

function activePlantTick(replay: Replay, round: Round, tick: number): number {
  let plantTick = -1;
  for (const e of replay.bombEvents) {
    if (e.tick > tick || e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "planted") {
      plantTick = e.tick;
    } else if ((e.kind === "defused" || e.kind === "exploded") && e.tick >= plantTick) {
      plantTick = -1;
    }
  }
  return plantTick;
}

/**
 * Exclusive end tick for this plant. The explode tick still belongs to it;
 * the next plant tick does not.
 */
function plantWindowEnd(replay: Replay, round: Round, plantTick: number): number {
  let end = round.end_tick + 1;
  for (const e of replay.bombEvents) {
    if (e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "exploded" && e.tick >= plantTick && e.tick + 1 < end) {
      end = e.tick + 1;
    } else if (e.kind === "planted" && e.tick > plantTick && e.tick < end) {
      end = e.tick;
    }
  }
  return end;
}

/**
 * Whether this plant has a begin, abort, or defused event anywhere in its
 * window, including events after the playback tick. The flags-vs-events
 * choice is about the rest of that plant, not only what has happened so far.
 */
function plantHasDefuseEvents(replay: Replay, round: Round, plantTick: number): boolean {
  const end = plantWindowEnd(replay, round, plantTick);
  for (const e of replay.bombEvents) {
    if (
      e.tick < plantTick ||
      e.tick >= end ||
      e.tick < round.start_tick ||
      e.tick > round.end_tick
    ) {
      continue;
    }
    if (e.kind === "begin_defuse" || e.kind === "abort_defuse" || e.kind === "defused") {
      return true;
    }
  }
  return false;
}

function defuseBeginFromEvents(
  replay: Replay,
  round: Round,
  plantTick: number,
  tick: number,
): DefuseBegin | null {
  let begin: DefuseBegin | null = null;
  for (const e of replay.bombEvents) {
    if (
      e.tick > tick ||
      e.tick < plantTick ||
      e.tick < round.start_tick ||
      e.tick > round.end_tick
    ) {
      continue;
    }
    if (e.kind === "begin_defuse") {
      begin = { tick: e.tick, haskit: !!e.haskit, player: e.player };
    } else if (
      e.kind === "abort_defuse" ||
      e.kind === "defused" ||
      e.kind === "exploded" ||
      e.kind === "planted"
    ) {
      begin = null;
    }
  }
  return begin;
}

/**
 * GOTV events and entity snapshots can land in different packets, so the
 * defuse flag is trusted only after this many sampled frames past begin.
 */
const DEFUSE_FLAG_SLACK_FRAMES = 2;

/**
 * `bomb_abortdefuse` is not guaranteed in GOTV. After two header tick strides
 * past begin, the attempt is over when no alive, present CT still has
 * `FLAG_DEFUSING`. The event slot is not used as a column index. Frames
 * inside the slack stay ignored so a late snapshot cannot cancel a real defuse.
 */
function defuseFlagReleased(replay: Replay, tick: number, begin: DefuseBegin): boolean {
  if (tick < defuseFlagReadyTick(replay, begin.tick)) {
    return false;
  }
  return columnDefuser(replay, tick) == null;
}

/** Alive, present CT whose sample has `FLAG_DEFUSING`. */
function columnDefuser(replay: Replay, tick: number) {
  return samplePlayers(replay, tick).find((p) => p.present && p.alive && p.ct && p.defusing);
}

function defuseFlagReadyTick(replay: Replay, beginTick: number): number {
  return beginTick + DEFUSE_FLAG_SLACK_FRAMES * tickStride(replay);
}

/** Snapshot spacing on `MatchHeader`, the stride `parseDemo` was called with. */
function tickStride(replay: Replay): number {
  const stride = replay.header.tick_stride;
  return stride > 0 ? stride : 1;
}

/** A kill of the begin event's player. */
function defuserDown(replay: Replay, tick: number, begin: DefuseBegin): boolean {
  if (begin.player < 0) {
    return false;
  }
  for (const kill of replay.kills) {
    if (kill.victim === begin.player && kill.tick >= begin.tick && kill.tick <= tick) {
      return true;
    }
  }
  return false;
}

/**
 * Event `haskit`, or `GEAR_DEFUSER` on the column-side defuser. Before the
 * slack elapses the flag may not be sampled yet, so only the event counts.
 */
function defuseHasKit(replay: Replay, tick: number, begin: DefuseBegin): boolean {
  if (begin.haskit) {
    return true;
  }
  if (tick < defuseFlagReadyTick(replay, begin.tick)) {
    return false;
  }
  const defuser = columnDefuser(replay, tick);
  return !!defuser && (defuser.gear & GEAR_DEFUSER) !== 0;
}

/** Active plant: 3.2s arm. Cancels on plant, drop, death, or timeout (FACEIT beginplant). */
export function plantClock(replay: Replay, tick: number): { remaining: number } | null {
  const tps = tickRate(replay);
  const round = currentRound(replay, tick);
  if (!round || tick > round.end_tick) {
    return null;
  }

  let begin: { tick: number; player: number } | null = null;
  let cancelled = false;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) {
      continue;
    }
    if (e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "begin_plant") {
      begin = { tick: e.tick, player: e.player };
      cancelled = false;
    } else if (e.kind === "planted" || e.kind === "dropped") {
      begin = null;
      cancelled = true;
    }
  }
  if (!begin) {
    if (cancelled) {
      return null;
    }
    begin = plantBeginFromFlags(replay, tick, round.start_tick);
    if (!begin) {
      return null;
    }
  }

  const players = samplePlayers(replay, tick);
  if (begin.player >= 0 && players.length > 0) {
    const p = players.find((x) => x.index === begin.player);
    if (p && (!p.alive || !p.present)) {
      return null;
    }
  }

  const remaining = PLANT_SECONDS - (tick - begin.tick) / tps;
  if (remaining < -0.25) {
    return null;
  }
  return { remaining: Math.max(0, remaining) };
}

function defuseBeginFromFlags(replay: Replay, tick: number, plantTick: number): DefuseBegin | null {
  const defuser = columnDefuser(replay, tick);
  if (!defuser) {
    return null;
  }
  const start = trailingFlagStart(replay, defuser.index, FLAG_DEFUSING, plantTick, tick);
  if (start == null) {
    return null;
  }
  return {
    tick: start,
    haskit: (defuser.gear & GEAR_DEFUSER) !== 0,
    player: defuser.index,
  };
}

function plantBeginFromFlags(
  replay: Replay,
  tick: number,
  fromTick: number,
): { tick: number; player: number } | null {
  const planter = samplePlayers(replay, tick).find((p) => p.planting && p.alive && p.present);
  if (!planter) {
    return null;
  }
  const start = trailingFlagStart(replay, planter.index, FLAG_PLANTING, fromTick, tick);
  if (start == null) {
    return null;
  }
  return { tick: start, player: planter.index };
}
