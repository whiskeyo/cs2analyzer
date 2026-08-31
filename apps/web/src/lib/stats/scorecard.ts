import {
  FIRST_OVERTIME_ROUND,
  OVERTIME_BLOCK_ROUNDS,
  REGULATION_ROUNDS,
  REGULATION_ROUNDS_PER_HALF,
} from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";

export interface MatchHalfScore {
  /** Wins for the team that started on CT / T. */
  a: number;
  b: number;
  /** Wins for the CT / T side in this half (for colored display). */
  ct: number;
  t: number;
}

/** Starting-side scorecard for a saved note. `teamA`/`teamB` are who was on CT/T at pistol. */
export interface MatchScorecard {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  firstHalf: MatchHalfScore | null;
  secondHalf: MatchHalfScore | null;
  overtime: MatchHalfScore | null;
}

/** Compact player row stored on a saved note (not the live scoreboard). */
export interface SavedPlayerSnapshot {
  name: string;
  start_side: Side;
  kills: number;
  deaths: number;
  adr: number;
  kast: number;
  rating: number;
}

export function roundSidesSwapped(replay: Replay, round: Round): boolean {
  const tick = round.freeze_end_tick || round.start_tick;
  const snap = samplePlayers(replay, tick);
  const present = snap.filter((p) => p.present);
  if (present.length === 0) {
    return swappedBySchedule(round.number);
  }
  let flipped = 0;
  for (const p of present) {
    const startedCt = replay.players[p.index]?.start_side === "CT";
    if (p.ct !== startedCt) {
      flipped += 1;
    }
  }
  return flipped * 2 > present.length;
}

function swappedBySchedule(number: number): boolean {
  if (number <= 0 || number <= REGULATION_ROUNDS_PER_HALF) {
    return false;
  }
  if (number <= REGULATION_ROUNDS) {
    return true;
  }
  return Math.floor((number - FIRST_OVERTIME_ROUND) / OVERTIME_BLOCK_ROUNDS) % 2 === 1;
}

export function winnerStartingSide(replay: Replay, round: Round): Side | null {
  if (!round.winner) {
    return null;
  }
  return roundSidesSwapped(replay, round) ? flipSide(round.winner) : round.winner;
}

function flipSide(side: Side): Side {
  return side === "CT" ? "T" : "CT";
}

function emptyHalf(): MatchHalfScore {
  return { a: 0, b: 0, ct: 0, t: 0 };
}

function addHalfWin(half: MatchHalfScore, round: Round, toA: boolean): void {
  if (toA) {
    half.a += 1;
  } else {
    half.b += 1;
  }
  if (round.winner === "CT") {
    half.ct += 1;
  } else if (round.winner === "T") {
    half.t += 1;
  }
}

/** Last tick that still belongs to a played round (or the last sampled frame). */
export function matchEndTick(replay: Replay): number {
  let max = 0;
  for (const r of replay.rounds) {
    if (r.end_tick > max) {
      max = r.end_tick;
    }
  }
  if (replay.ticks.frameCount > 0) {
    const last = replay.ticks.ticks[replay.ticks.frameCount - 1] ?? 0;
    if (last > max) {
      max = last;
    }
  }
  return max;
}

/**
 * Wins for the teams that started CT / T, split by regulation half and OT.
 * Empty halves are omitted so a pistol-only save does not print `0:0`.
 */
export function matchScorecard(replay: Replay, tick: number): MatchScorecard {
  const firstHalf = emptyHalf();
  const secondHalf = emptyHalf();
  const overtime = emptyHalf();
  let hasFirst = false;
  let hasSecond = false;
  let hasOt = false;
  let scoreA = 0;
  let scoreB = 0;
  for (const r of replay.rounds) {
    if (r.is_knife || r.end_tick > tick) {
      continue;
    }
    const start = winnerStartingSide(replay, r);
    if (start !== "CT" && start !== "T") {
      continue;
    }
    const toA = start === "CT";
    if (toA) {
      scoreA += 1;
    } else {
      scoreB += 1;
    }
    const n = r.number;
    if (n <= 0) {
      continue;
    }
    if (n <= REGULATION_ROUNDS_PER_HALF) {
      hasFirst = true;
      addHalfWin(firstHalf, r, toA);
    } else if (n <= REGULATION_ROUNDS) {
      hasSecond = true;
      addHalfWin(secondHalf, r, toA);
    } else {
      hasOt = true;
      addHalfWin(overtime, r, toA);
    }
  }
  return {
    teamA: replay.header.team_ct || "CT",
    teamB: replay.header.team_t || "T",
    scoreA,
    scoreB,
    firstHalf: hasFirst ? firstHalf : null,
    secondHalf: hasSecond ? secondHalf : null,
    overtime: hasOt ? overtime : null,
  };
}

export function formatScorecard(card: MatchScorecard): string {
  const halves: string[] = [];
  if (card.firstHalf) {
    halves.push(`${card.firstHalf.a}:${card.firstHalf.b}`);
  }
  if (card.secondHalf) {
    halves.push(`${card.secondHalf.a}:${card.secondHalf.b}`);
  }
  if (card.overtime) {
    halves.push(`OT ${card.overtime.a}:${card.overtime.b}`);
  }
  const detail = halves.length > 0 ? ` (${halves.join(", ")})` : "";
  return `${card.teamA} - ${card.teamB}, ${card.scoreA}:${card.scoreB}${detail}`;
}
