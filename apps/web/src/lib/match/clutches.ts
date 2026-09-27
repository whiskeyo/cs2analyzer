import { currentRound, samplePlayer, samplePlayers } from "@/lib/replay/sample";
import type { Kill, Replay, Round, Side } from "@/lib/replay/replayTypes";
import { CLUTCH_BOARD_MIN_ENEMIES } from "@/lib/shared/constants";
import { WEAPON_BY_ID } from "@/lib/weapons/weapons";

export interface ClutchAttempt {
  tick: number;
  round: number;
  roundLabel: string;
  player: number;
  name: string;
  vs: number;
  side: Side;
  won: boolean;
}

/** One 1v2+ situation for the match clutch board. `vs` is enemies alive at the start. */
export interface ClutchBoardRow extends ClutchAttempt {
  /** Weapon key in hand at `tick` (`ak47`), or empty when the demo has no loadout. */
  weapon: string;
  x: number;
  y: number;
  /** False when that player has no pawn sample at the start tick. */
  placed: boolean;
}

function roundLabel(r: Round): string {
  return r.is_knife ? "Knife" : `R${r.number}`;
}

function roundKills(replay: Replay, round: Round, untilTick: number): Kill[] {
  const end = Math.min(round.end_tick, untilTick);
  return replay.kills.filter(
    (k) => k.tick >= round.freeze_end_tick && k.tick <= end && k.tick <= round.end_tick,
  );
}

/** 1vX attempts in completed rounds, jumping to the tick the clutch started. */
export function clutchAttempts(replay: Replay, untilTick: number): ClutchAttempt[] {
  const out: ClutchAttempt[] = [];
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    if (round.freeze_end_tick > untilTick) continue;
    if (round.end_tick > untilTick) continue;
    const found = clutchesInRound(replay, round, untilTick);
    out.push(...found);
  }
  return out;
}

function clutchesInRound(replay: Replay, round: Round, untilTick: number): ClutchAttempt[] {
  const snap = samplePlayers(replay, round.freeze_end_tick || round.start_tick);
  const alive = new Set<number>();
  const side = new Map<number, Side>();
  for (const p of snap) {
    if (!p.present) continue;
    side.set(p.index, p.ct ? "CT" : "T");
    if (p.alive) alive.add(p.index);
  }

  let clutchCt: { player: number; vs: number; tick: number } | null = null;
  let clutchT: { player: number; vs: number; tick: number } | null = null;
  let atTick = round.freeze_end_tick || round.start_tick;

  const count = (want: Side) => {
    let n = 0;
    for (const i of alive) if (side.get(i) === want) n += 1;
    return n;
  };
  const lastAlive = (want: Side) => {
    for (const i of alive) if (side.get(i) === want) return i;
    return -1;
  };

  const note = () => {
    const ctN = count("CT");
    const tN = count("T");
    if (!clutchCt && ctN === 1 && tN >= 1) {
      const p = lastAlive("CT");
      if (p >= 0) clutchCt = { player: p, vs: tN, tick: atTick };
    }
    if (!clutchT && tN === 1 && ctN >= 1) {
      const p = lastAlive("T");
      if (p >= 0) clutchT = { player: p, vs: ctN, tick: atTick };
    }
  };

  note();
  for (const k of roundKills(replay, round, untilTick)) {
    if (k.victim >= 0) alive.delete(k.victim);
    atTick = k.tick;
    note();
  }

  const row = (
    c: { player: number; vs: number; tick: number } | null,
    won: boolean,
  ): ClutchAttempt | null => {
    if (!c || c.player < 0) return null;
    const sideNow = side.get(c.player);
    if (!sideNow) return null;
    return {
      tick: c.tick,
      round: round.number,
      roundLabel: roundLabel(round),
      player: c.player,
      name: replay.players[c.player]?.name ?? "?",
      vs: c.vs,
      side: sideNow,
      won,
    };
  };

  return [row(clutchCt, round.winner === "CT"), row(clutchT, round.winner === "T")].filter(
    (x): x is ClutchAttempt => x != null,
  );
}

function weaponKey(active: number, primary: number, secondary: number): string {
  const id = active || primary || secondary;
  return WEAPON_BY_ID[id] ?? "";
}

/**
 * Completed-round 1v2+ clutches for a single demo, in start order.
 * Includes wins and losses. 1v1 is omitted (`CLUTCH_BOARD_MIN_ENEMIES`).
 */
export function clutchBoard(replay: Replay): ClutchBoardRow[] {
  const until = replay.rounds.reduce((max, round) => Math.max(max, round.end_tick), 0);
  const rows: ClutchBoardRow[] = [];
  for (const attempt of clutchAttempts(replay, until)) {
    if (attempt.vs < CLUTCH_BOARD_MIN_ENEMIES) continue;
    const pawn = samplePlayer(replay, attempt.player, attempt.tick);
    rows.push({
      ...attempt,
      weapon: pawn ? weaponKey(pawn.active, pawn.primary, pawn.secondary) : "",
      x: pawn?.x ?? 0,
      y: pawn?.y ?? 0,
      placed: pawn != null && pawn.present,
    });
  }
  return rows;
}

export function liveClutch(replay: Replay, tick: number): ClutchAttempt | null {
  const round = currentRound(replay, tick);
  if (!round || round.is_knife || tick < round.freeze_end_tick || tick >= round.end_tick) {
    return null;
  }
  const found = clutchesInRound(replay, round, tick);
  if (found.length === 0) return null;
  const live = found.find((c) => {
    const snap = samplePlayers(replay, tick);
    const p = snap.find((s) => s.index === c.player);
    return p?.present && p.alive;
  });
  return live ?? null;
}
