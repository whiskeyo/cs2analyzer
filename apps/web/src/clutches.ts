import { currentRound, samplePlayers } from "./sample";
import type { Kill, Replay, Round, Side } from "./types";

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
