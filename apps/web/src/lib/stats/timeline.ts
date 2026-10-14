import { roundSideBuys, type EconomyBuy } from "@/lib/match/economy";
import { playerLabel } from "@/lib/replay/playerLabel";
import { samplePlayer } from "@/lib/replay/sample";
import type { PlayerStats, Replay, Round, Side } from "@/lib/replay/replayTypes";
import { WIN_REASON_DRAW } from "@/lib/shared/constants";
import { roundSidesSwapped } from "./scorecard";
import { computeStats } from "./computeStats";

/** Scoreboard percents (HS%, KAST) share this 0–100 scale. */
const PERCENT_SCALE = 100;

export type TimelineStatId =
  "kills" | "kd" | "hs" | "adr" | "opening" | "kast" | "util" | "flashed";

export type TimelineMode = "cumulative" | "round";

export interface TimelineStatDef {
  id: TimelineStatId;
  label: string;
  /** Sums grow by addition. Rates are a running ratio (K/D, HS%, ADR, KAST). */
  kind: "sum" | "rate";
}

export const TIMELINE_GROUPS: readonly { label: string; stats: readonly TimelineStatDef[] }[] = [
  {
    label: "Frags",
    stats: [
      { id: "kills", label: "Kills", kind: "sum" },
      { id: "kd", label: "K/D", kind: "rate" },
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
  /** Null when the round has no winner yet. */
  won: boolean | null;
  buy: EconomyBuy | null;
  values: Record<TimelineStatId, TimelineStatValue>;
}

export interface TimelineColumn {
  number: number;
  rows: TimelinePlayerRow[];
}

interface RawRound {
  kills: number;
  deaths: number;
  headshots: number;
  damage: number;
  utility: number;
  opening: number;
  kastRounds: number;
  flashed: number;
}

interface TickRange {
  start: number;
  end: number;
}

const ZERO_RAW: RawRound = {
  kills: 0,
  deaths: 0,
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

export function plottedValue(value: TimelineStatValue, mode: TimelineMode): number {
  return mode === "cumulative" ? value.running : value.round;
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
    case "kd":
      return value.toFixed(2);
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
 * One column per counted round. Totals follow `computeStats` once knife rounds
 * and restarts are left out, so the chart matches the scoreboard on a normal demo.
 */
export function statsTimeline(replay: Replay): TimelineColumn[] {
  const counted = timelineRounds(replay);
  if (counted.length === 0) return [];
  const source = replayWithoutRestarts(replay, counted);
  const previous = replay.players.map(() => ZERO_RAW);
  const columns: TimelineColumn[] = [];
  for (const round of counted) {
    const stats = computeStats(source, round.end_tick);
    const buys = roundSideBuys(replay, round);
    const rows: TimelinePlayerRow[] = stats.map((row) => {
      const next = rawFrom(row);
      const delta = diffRaw(next, previous[row.player] ?? ZERO_RAW);
      previous[row.player] = next;
      const side = sideAt(replay, row.player, round);
      return {
        player: row.player,
        name: playerLabel(replay.players[row.player]),
        side,
        won: round.winner == null ? null : round.winner === side,
        buy: side === "CT" ? buys.ct : buys.t,
        values: valuesFor(delta, row),
      };
    });
    columns.push({ number: round.number, rows });
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
    deaths: stats.deaths,
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
    deaths: nonNegative(next.deaths - prev.deaths),
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
  const roundKd = delta.deaths > 0 ? delta.kills / delta.deaths : delta.kills;
  const roundHs = delta.kills > 0 ? (PERCENT_SCALE * delta.headshots) / delta.kills : 0;
  const roundKast = delta.kastRounds > 0 ? PERCENT_SCALE : 0;
  return {
    kills: { round: delta.kills, running: cumulative.kills },
    kd: { round: roundKd, running: cumulative.kd },
    hs: { round: roundHs, running: cumulative.headshot_percent },
    adr: { round: delta.damage, running: cumulative.adr },
    opening: { round: delta.opening, running: cumulative.first_kills },
    kast: { round: roundKast, running: cumulative.kast },
    util: { round: delta.utility, running: cumulative.utility_damage },
    flashed: { round: delta.flashed, running: cumulative.enemies_flashed },
  };
}

function sideAt(replay: Replay, player: number, round: Round): Side {
  const freeze = round.freeze_end_tick || round.start_tick;
  const snap = samplePlayer(replay, player, freeze);
  if (snap?.present) return snap.ct ? "CT" : "T";
  const start = replay.players[player]?.start_side ?? "T";
  if (!roundSidesSwapped(replay, round)) return start;
  return start === "CT" ? "T" : "CT";
}

function replayWithoutRestarts(replay: Replay, counted: readonly Round[]): Replay {
  const countedSet = new Set(counted);
  const voids = replay.rounds.filter((round) => !round.is_knife && !countedSet.has(round));
  if (voids.length === 0) return replay;
  const ranges = voidRanges(replay.rounds, voids);
  const keep = (tick: number) => !ranges.some((range) => tick >= range.start && tick < range.end);
  return {
    ...replay,
    rounds: replay.rounds.filter((round) => !voids.includes(round)),
    kills: replay.kills.filter((event) => keep(event.tick)),
    hurts: replay.hurts.filter((event) => keep(event.tick)),
    blinds: replay.blinds.filter((event) => keep(event.tick)),
  };
}

function voidRanges(rounds: readonly Round[], voids: readonly Round[]): TickRange[] {
  return voids.map((round) => {
    const index = rounds.indexOf(round);
    const next = rounds.slice(index + 1).find((candidate) => !candidate.is_knife);
    const end = next ? next.start_tick : round.end_tick + 1;
    return { start: round.start_tick, end: Math.max(end, round.start_tick) };
  });
}
