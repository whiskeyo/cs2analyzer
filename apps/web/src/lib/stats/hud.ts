import {
  BOMB_SECONDS,
  DEFUSE_WITH_KIT_SECONDS,
  DEFUSE_WITHOUT_KIT_SECONDS,
  tickRate,
} from "@/lib/shared/constants";
import { currentRound, samplePlayers } from "@/lib/replay/sample";
import {
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
    freeze: freezeRemaining(replay, tick),
    roundWin: roundWinBanner(replay, tick),
  };
}

/** Planted C4 while it is still in play. Stops on defuse/explode, 40s, round over, or CT wipe. */
export function activeBomb(
  replay: Replay,
  tick: number,
): { remaining: number; planted: boolean; x: number; y: number } | null {
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
  return { ...clock, ...plant };
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

/** Active defuse: kit is 5s, no kit is 10s. Cancels on abort, death, explode, or defuse. */
export function defuseClock(
  replay: Replay,
  tick: number,
): { remaining: number; haskit: boolean } | null {
  const tps = tickRate(replay);
  const round = currentRound(replay, tick);
  if (!round || tick > round.end_tick) {
    return null;
  }

  let plantTick = -1;
  let begin: { tick: number; haskit: boolean; player: number } | null = null;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) {
      continue;
    }
    if (e.tick < round.start_tick || e.tick > round.end_tick) {
      continue;
    }
    if (e.kind === "planted") {
      plantTick = e.tick;
      begin = null;
    } else if (e.kind === "begin_defuse" && plantTick >= 0) {
      begin = { tick: e.tick, haskit: !!e.haskit, player: e.player };
    } else if (e.kind === "abort_defuse") {
      begin = null;
    } else if (e.kind === "defused" || e.kind === "exploded") {
      plantTick = -1;
      begin = null;
    }
  }
  if (!begin || plantTick < 0) {
    return null;
  }

  const players = samplePlayers(replay, tick);
  if (begin.player >= 0 && players.length > 0) {
    const p = players.find((x) => x.index === begin.player);
    if (p && (!p.alive || !p.present)) {
      return null;
    }
    if (!begin.haskit && p && (p.gear & GEAR_DEFUSER) !== 0) {
      begin.haskit = true;
    }
  }

  const duration = begin.haskit ? DEFUSE_WITH_KIT_SECONDS : DEFUSE_WITHOUT_KIT_SECONDS;
  const remaining = duration - (tick - begin.tick) / tps;
  if (remaining < -0.25) {
    return null;
  }
  return { remaining: Math.max(0, remaining), haskit: begin.haskit };
}
