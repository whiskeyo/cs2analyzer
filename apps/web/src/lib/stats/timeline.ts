import { roundSideBuys, type EconomyBuy } from "@/lib/match/economy";
import { playerLabel } from "@/lib/replay/playerLabel";
import { samplePlayer } from "@/lib/replay/sample";
import type { PlayerStats, Replay, Round, Side } from "@/lib/replay/replayTypes";
import { WIN_REASON_DRAW } from "@/lib/shared/constants";
import { roundSidesSwapped } from "./scorecard";
import { computeStats } from "./computeStats";

/** Scoreboard percents (HS%, KAST) share this 0–100 scale. */
const PERCENT_SCALE = 100;

export type TimelineStatId = "kills" | "hs" | "adr" | "opening" | "kast" | "util" | "flashed";

export interface TimelineStatDef {
  id: TimelineStatId;
  label: string;
  /** Sums are a running total. Rates are a running ratio (HS%, ADR, KAST). */
  kind: "sum" | "rate";
}

export const TIMELINE_GROUPS: readonly { label: string; stats: readonly TimelineStatDef[] }[] = [
  {
    label: "Frags",
    stats: [
      { id: "kills", label: "Kills", kind: "sum" },
      { id: "hs", label: "HS%", kind: "rate" },
    ],
  },
  {
    label: "Impact",
    stats: [
      { id: "adr", label: "ADR", kind: "rate" },
      { id: "opening", label: "Opening kills", kind: "sum" },
      { id: "kast", label: "KAST", kind: "rate" },
    ],
  },
  {
    label: "Utility",
    stats: [
      { id: "util", label: "Util dmg", kind: "sum" },
      { id: "flashed", label: "Enemies flashed", kind: "sum" },
    ],
  },
];

export interface TimelineStatValue {
  /** What happened in this round (damage for ADR, 0–100 for HS% and KAST). */
  round: number;
  /** Running sum, or the running rate through this round. */
  running: number;
}

export interface TimelinePlayerRow {
  player: number;
  name: string;
  side: Side;
  /** False when the freeze sample exists and this pawn was not in the round. */
  present: boolean;
  /** Null when the round has no winner yet. */
  won: boolean | null;
  buy: EconomyBuy | null;
  values: Record<TimelineStatId, TimelineStatValue>;
}

export interface TimelineColumn {
  number: number;
  rows: TimelinePlayerRow[];
  winner: Side | null;
  winReason: number;
  /** Starting side of the roster that won this round. */
  winRoster: Side | null;
}

interface RawRound {
  kills: number;
  headshots: number;
  damage: number;
  utility: number;
  opening: number;
  kastRounds: number;
  flashed: number;
}

const ZERO_RAW: RawRound = {
  kills: 0,
  headshots: 0,
  damage: 0,
  utility: 0,
  opening: 0,
  kastRounds: 0,
  flashed: 0,
};

export function timelineStat(id: TimelineStatId): TimelineStatDef {
  for (const group of TIMELINE_GROUPS) {
    for (const stat of group.stats) {
      if (stat.id === id) return stat;
    }
  }
  return TIMELINE_GROUPS[0].stats[0];
}

/** The chart always plots the running total or running rate. */
export function plottedValue(value: TimelineStatValue): number {
  return value.running;
}

export function formatTimelineValue(id: TimelineStatId, value: number): string {
  switch (id) {
    case "kills":
    case "opening":
    case "flashed":
    case "util":
      return String(Math.round(value));
    case "adr":
      return compact(value, 1);
    case "hs":
    case "kast":
      return `${Math.round(value)}%`;
  }
}

/**
 * A competitive round that should not appear on the timeline.
 * Knife rounds are filtered by the caller. A restart is either an aborted
 * round (no winner, and another round follows) or a decided round whose win
 * did not change the score the next round enters on. Draws stay.
 */
export function isRestartRound(
  round: Round,
  next: Round | undefined,
  knownScores: boolean,
): boolean {
  if (!next) return false;
  if (round.win_reason === WIN_REASON_DRAW) return false;
  if (round.winner == null) return true;
  if (!knownScores) return false;
  return next.score_ct === round.score_ct && next.score_t === round.score_t;
}

/** Competitive rounds with knife rounds and restarts removed. */
export function timelineRounds(replay: Replay): Round[] {
  const competitive = replay.rounds.filter((round) => !round.is_knife);
  const knownScores = competitive.some((round) => round.score_ct !== 0 || round.score_t !== 0);
  return competitive.filter(
    (round, index) => !isRestartRound(round, competitive[index + 1], knownScores),
  );
}

/**
 * One column per counted round. Running totals are `computeStats` on the same
 * replay the Score panel uses, through that round's end tick. Knife frags stay
 * out because `computeStats` already skips them. Restart rounds stay off the
 * axis, but their events stay in the total so the last column matches Score.
 */
export function statsTimeline(replay: Replay): TimelineColumn[] {
  const counted = timelineRounds(replay);
  if (counted.length === 0) return [];
  const previous = replay.players.map(() => ZERO_RAW);
  const columns: TimelineColumn[] = [];
  for (const round of counted) {
    const stats = computeStats(replay, round.end_tick);
    const buys = roundSideBuys(replay, round);
    const rows: TimelinePlayerRow[] = stats
      .filter((row) => !replay.players[row.player]?.is_bot)
      .map((row) => {
        const next = rawFrom(row);
        const delta = diffRaw(next, previous[row.player] ?? ZERO_RAW);
        previous[row.player] = next;
        const sampled = sideSample(replay, row.player, round);
        return {
          player: row.player,
          name: playerLabel(replay.players[row.player]),
          side: sampled.side,
          present: sampled.present,
          won: round.winner == null ? null : round.winner === sampled.side,
          buy: sampled.side === "CT" ? buys.ct : buys.t,
          values: valuesFor(delta, row),
        };
      });
    columns.push({
      number: round.number,
      rows,
      winner: round.winner,
      winReason: round.win_reason,
      winRoster: winningRoster(replay, round),
    });
  }
  return columns;
}

function compact(value: number, digits: number): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(digits);
}

function rawFrom(stats: PlayerStats): RawRound {
  return {
    kills: stats.kills,
    headshots: stats.headshots,
    damage: stats.damage,
    utility: stats.utility_damage,
    opening: stats.first_kills,
    kastRounds: stats.kast_rounds,
    flashed: stats.enemies_flashed,
  };
}

function diffRaw(next: RawRound, prev: RawRound): RawRound {
  return {
    kills: nonNegative(next.kills - prev.kills),
    headshots: nonNegative(next.headshots - prev.headshots),
    damage: nonNegative(next.damage - prev.damage),
    utility: nonNegative(next.utility - prev.utility),
    opening: nonNegative(next.opening - prev.opening),
    kastRounds: nonNegative(next.kastRounds - prev.kastRounds),
    flashed: nonNegative(next.flashed - prev.flashed),
  };
}

function nonNegative(value: number): number {
  return value > 0 ? value : 0;
}

function valuesFor(
  delta: RawRound,
  cumulative: PlayerStats,
): Record<TimelineStatId, TimelineStatValue> {
  const roundHs = delta.kills > 0 ? (PERCENT_SCALE * delta.headshots) / delta.kills : 0;
  const roundKast = delta.kastRounds > 0 ? PERCENT_SCALE : 0;
  return {
    kills: { round: delta.kills, running: cumulative.kills },
    hs: { round: roundHs, running: cumulative.headshot_percent },
    adr: { round: delta.damage, running: cumulative.adr },
    opening: { round: delta.opening, running: cumulative.first_kills },
    kast: { round: roundKast, running: cumulative.kast },
    util: { round: delta.utility, running: cumulative.utility_damage },
    flashed: { round: delta.flashed, running: cumulative.enemies_flashed },
  };
}

function winningRoster(replay: Replay, round: Round): Side | null {
  if (round.winner == null) return null;
  for (const player of replay.players) {
    if (sideAt(replay, player.index, round) === round.winner) return player.start_side;
  }
  if (!roundSidesSwapped(replay, round)) return round.winner;
  return round.winner === "CT" ? "T" : "CT";
}

function sideAt(replay: Replay, player: number, round: Round): Side {
  return sideSample(replay, player, round).side;
}

/**
 * A missing tick stream keeps the start-side fallback so a side still exists.
 * A sample that is not present stays out of side-swap detection.
 */
function sideSample(
  replay: Replay,
  player: number,
  round: Round,
): { side: Side; present: boolean } {
  const freeze = round.freeze_end_tick || round.start_tick;
  const snap = samplePlayer(replay, player, freeze);
  if (snap?.present) return { side: snap.ct ? "CT" : "T", present: true };
  return { side: sideFromStart(replay, player, round), present: snap == null };
}

function sideFromStart(replay: Replay, player: number, round: Round): Side {
  const start = replay.players[player]?.start_side ?? "T";
  if (!roundSidesSwapped(replay, round)) return start;
  return start === "CT" ? "T" : "CT";
}
