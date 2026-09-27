import { samplePlayers } from "@/lib/replay/sample";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import {
  ECO_MAX_EQUIPMENT,
  FIRST_OVERTIME_ROUND,
  FORCE_BUY_MAX_EQUIPMENT,
  OVERTIME_BLOCK_ROUNDS,
  REGULATION_ROUNDS_PER_HALF,
} from "@/lib/shared/constants";

/** Equipment band at freeze. Same cutoffs as the round story and series tags. */
export type SpendBuy = "eco" | "force" | "full";

/**
 * Buy shown on the economy timeline.
 * Regulation pistols (round 1 and 13) stay pistols.
 * Anti-eco is a force or full buy against an eco. Overtime uses equipment only:
 * CS2 overtime starts on full money, so the first OT round is not a pistol.
 */
export type EconomyBuy = "pistol" | SpendBuy | "anti-eco";

export const ECONOMY_BUY_ORDER: readonly EconomyBuy[] = [
  "pistol",
  "eco",
  "force",
  "anti-eco",
  "full",
];

export const ECONOMY_BUY_LABEL: Record<EconomyBuy, string> = {
  pistol: "Pistol",
  eco: "Eco",
  force: "Force",
  "anti-eco": "Anti-eco",
  full: "Full",
};

const PERCENT_SCALE = 100;

export interface SideEconomy {
  side: Side;
  team: string;
  buy: EconomyBuy | null;
  averageEquipment: number | null;
}

export interface RoundEconomy {
  round: number;
  jumpTick: number;
  winner: Side | null;
  ct: SideEconomy;
  t: SideEconomy;
}

export interface BuyWinRate {
  buy: EconomyBuy;
  rounds: number;
  wins: number;
}

export interface TeamBuyRates {
  team: string;
  rows: BuyWinRate[];
}

export interface EconomyCell {
  round: number;
  jumpTick: number;
  buy: EconomyBuy | null;
  won: boolean;
  /** False when the round has no winner yet. */
  decided: boolean;
  side: Side;
  averageEquipment: number | null;
  breakBefore: boolean;
}

export interface EconomyRow {
  team: string;
  cells: EconomyCell[];
}

export interface MatchEconomy {
  rounds: RoundEconomy[];
  rows: EconomyRow[];
  rates: TeamBuyRates[];
}

export function spendBuy(averageEquipment: number): SpendBuy {
  if (averageEquipment < ECO_MAX_EQUIPMENT) return "eco";
  if (averageEquipment < FORCE_BUY_MAX_EQUIPMENT) return "force";
  return "full";
}

export function formatBuyRecord(wins: number, rounds: number): string {
  return `${wins}/${rounds}`;
}

export function formatBuyWinRate(wins: number, rounds: number): string {
  if (rounds <= 0) return "—";
  return `${Math.round((wins / rounds) * PERCENT_SCALE)}%`;
}

/** Average freeze equipment for one side. Null when nobody on that side is present. */
export function sideAverageEquipment(replay: Replay, tick: number, ct: boolean): number | null {
  const players = samplePlayers(replay, tick).filter(
    (player) => player.present && player.ct === ct,
  );
  if (players.length === 0) return null;
  return players.reduce((sum, player) => sum + player.equip, 0) / players.length;
}

export function roundSideBuys(
  replay: Replay,
  round: Round,
): { ct: EconomyBuy | null; t: EconomyBuy | null } {
  const freeze = round.freeze_end_tick || round.start_tick;
  const ctAverage = sideAverageEquipment(replay, freeze, true);
  const tAverage = sideAverageEquipment(replay, freeze, false);
  return {
    ct: classifySide(round.number, ctAverage, tAverage),
    t: classifySide(round.number, tAverage, ctAverage),
  };
}

export function matchEconomy(replay: Replay): MatchEconomy {
  const rounds = competitiveEconomies(replay);
  const teams = teamOrder(rounds);
  return {
    rounds,
    rows: teams.map((team) => ({ team, cells: cellsForTeam(rounds, team) })),
    rates: teams.map((team) => ({ team, rows: ratesForTeam(rounds, team) })),
  };
}

function isRegulationPistol(roundNumber: number): boolean {
  return roundNumber === 1 || roundNumber === REGULATION_ROUNDS_PER_HALF + 1;
}

function classifySide(
  roundNumber: number,
  own: number | null,
  opponent: number | null,
): EconomyBuy | null {
  if (own == null) return null;
  if (isRegulationPistol(roundNumber)) return "pistol";
  const spend = spendBuy(own);
  if (spend !== "eco" && opponent != null && spendBuy(opponent) === "eco") return "anti-eco";
  return spend;
}

function teamAtFreeze(replay: Replay, round: Round, side: Side): string {
  const named = side === "CT" ? round.team_ct : round.team_t;
  if (named && named.trim() !== "") return named;
  return side === "CT" ? replay.header.team_ct : replay.header.team_t;
}

function competitiveEconomies(replay: Replay): RoundEconomy[] {
  const out: RoundEconomy[] = [];
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const freeze = round.freeze_end_tick || round.start_tick;
    const ctAverage = sideAverageEquipment(replay, freeze, true);
    const tAverage = sideAverageEquipment(replay, freeze, false);
    out.push({
      round: round.number,
      jumpTick: freeze,
      winner: round.winner,
      ct: {
        side: "CT",
        team: teamAtFreeze(replay, round, "CT"),
        buy: classifySide(round.number, ctAverage, tAverage),
        averageEquipment: ctAverage,
      },
      t: {
        side: "T",
        team: teamAtFreeze(replay, round, "T"),
        buy: classifySide(round.number, tAverage, ctAverage),
        averageEquipment: tAverage,
      },
    });
  }
  return out;
}

function teamOrder(rounds: readonly RoundEconomy[]): string[] {
  const names: string[] = [];
  for (const round of rounds) {
    for (const side of [round.ct, round.t]) {
      if (side.team !== "" && !names.includes(side.team)) names.push(side.team);
    }
  }
  return names;
}

function sideForTeam(round: RoundEconomy, team: string): SideEconomy | null {
  if (round.ct.team === team) return round.ct;
  if (round.t.team === team) return round.t;
  return null;
}

function isHalfStart(roundNumber: number): boolean {
  if (roundNumber === REGULATION_ROUNDS_PER_HALF + 1) return true;
  if (roundNumber < FIRST_OVERTIME_ROUND) return false;
  return (roundNumber - FIRST_OVERTIME_ROUND) % OVERTIME_BLOCK_ROUNDS === 0;
}

function cellsForTeam(rounds: readonly RoundEconomy[], team: string): EconomyCell[] {
  let previous: number | null = null;
  return rounds.map((round) => {
    const side = sideForTeam(round, team);
    const cell: EconomyCell = {
      round: round.round,
      jumpTick: round.jumpTick,
      buy: side?.buy ?? null,
      won: side != null && round.winner === side.side,
      decided: round.winner != null,
      side: side?.side ?? "CT",
      averageEquipment: side?.averageEquipment ?? null,
      breakBefore: previous != null && isHalfStart(round.round),
    };
    previous = round.round;
    return cell;
  });
}

function ratesForTeam(rounds: readonly RoundEconomy[], team: string): BuyWinRate[] {
  const counts = new Map<EconomyBuy, BuyWinRate>();
  for (const round of rounds) {
    const side = sideForTeam(round, team);
    if (!side?.buy) continue;
    const row = counts.get(side.buy) ?? { buy: side.buy, rounds: 0, wins: 0 };
    row.rounds += 1;
    if (round.winner === side.side) row.wins += 1;
    counts.set(side.buy, row);
  }
  return ECONOMY_BUY_ORDER.flatMap((buy) => {
    const row = counts.get(buy);
    return row ? [row] : [];
  });
}
