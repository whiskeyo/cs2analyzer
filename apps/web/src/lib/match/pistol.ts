import { getConvar, getConvarAt } from "@/lib/match/convars";
import { samplePlayers } from "@/lib/replay/sample";
import type { MatchInfo, Replay } from "@/lib/replay/replayTypes";
import { REGULATION_ROUNDS } from "@/lib/shared/constants";
import {
  regulationSideSwapAfter,
  type TimelineRoundPlayer,
  type TimelineRoundRoster,
} from "@/lib/stats/timelineChart";

/** Demo key for the regulation length. `0` means no round limit. */
const MAX_ROUNDS_CONVAR = "mp_maxrounds";

/** Demo key for halftime. `0` means the match never swaps at the half. */
const HALFTIME_CONVAR = "mp_halftime";

/**
 * `mp_maxrounds` when the convar is missing or not an integer.
 * Same length as MR12 regulation.
 */
const DEFAULT_MAX_ROUNDS = REGULATION_ROUNDS;

export interface PistolRoundContext {
  /**
   * Tick that selects the convar value then in effect (`getConvarAt`).
   * Omit to use `getConvar` (the demo's final value, or the tournament default).
   */
  tick?: number;
  /**
   * Competitive rounds in playback order, with the players present at freeze.
   * Same roster shape as the timeline half lines. A side swap here, while it
   * is still inside regulation, is the second pistol. With no swap, the second
   * pistol is `mp_maxrounds / 2 + 1`.
   */
  rounds?: readonly TimelineRoundRoster[];
}

/**
 * First round of a regulation half.
 *
 * Round 1 is always a pistol. The second pistol is the round after the
 * regulation side swap, or `mp_maxrounds / 2 + 1` when the sides never swap.
 * Any round past `mp_maxrounds` is overtime and is not a pistol.
 * `mp_maxrounds` <= 0 has no round limit and no second pistol.
 * A missing or unreadable `mp_maxrounds` is 24.
 * `mp_halftime` 0 has no second pistol.
 */
export function isPistolRound(
  roundNumber: number,
  matchInfo?: MatchInfo,
  context?: PistolRoundContext,
): boolean {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) return false;
  if (roundNumber === 1) return true;

  const maxRounds = maxRoundsInEffect(convarAt(matchInfo, MAX_ROUNDS_CONVAR, context?.tick));
  if (maxRounds == null || roundNumber > maxRounds) return false;
  if (halftimeOff(convarAt(matchInfo, HALFTIME_CONVAR, context?.tick))) return false;
  return roundNumber === secondPistolRound(maxRounds, context?.rounds);
}

/**
 * Rosters for {@link isPistolRound}. Knife rounds are omitted. A player counts
 * only when the freeze sample says they are present, which is the comparison
 * the timeline half lines use once a demo has tick data.
 */
export function regulationHalfRosters(replay: Replay): TimelineRoundRoster[] {
  const rosters: TimelineRoundRoster[] = [];
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const tick = round.freeze_end_tick || round.start_tick;
    const players: TimelineRoundPlayer[] = [];
    for (const player of samplePlayers(replay, tick)) {
      if (!player.present || replay.players[player.index]?.is_bot) continue;
      players.push({ player: player.index, side: player.ct ? "CT" : "T" });
    }
    rosters.push({ number: round.number, players });
  }
  return rosters;
}

function convarAt(
  matchInfo: MatchInfo | undefined,
  name: string,
  tick: number | undefined,
): string | undefined {
  if (tick == null) return getConvar(matchInfo, name);
  return getConvarAt(matchInfo, name, tick);
}

/**
 * Regulation length at this tick.
 * `null` means no round limit (`mp_maxrounds` <= 0): only round 1 is a pistol.
 */
function maxRoundsInEffect(raw: string | undefined): number | null {
  if (raw == null) return DEFAULT_MAX_ROUNDS;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return DEFAULT_MAX_ROUNDS;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return DEFAULT_MAX_ROUNDS;
  if (value <= 0) return null;
  return value;
}

function halftimeOff(raw: string | undefined): boolean {
  if (raw == null) return false;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "false") return true;
  if (!/^-?\d+$/.test(trimmed)) return false;
  return Number(trimmed) === 0;
}

function secondPistolRound(
  maxRounds: number,
  rounds: readonly TimelineRoundRoster[] | undefined,
): number | undefined {
  const swap = rounds == null ? undefined : regulationSideSwapAfter(rounds, maxRounds);
  const start = swap != null ? swap + 1 : Math.floor(maxRounds / 2) + 1;
  if (start <= 1 || start > maxRounds) return undefined;
  return start;
}
