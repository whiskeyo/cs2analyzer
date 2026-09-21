import { killLineEnds, openingDuel } from "@/lib/radar/radarFx";
import { attackerLabel, playerLabel } from "@/lib/replay/playerLabel";
import type { Replay, Side } from "@/lib/replay/replayTypes";
import { currentSide } from "@/lib/stats/stats";
import { prettyWeapon } from "@/lib/weapons/weapons";
import { roundLabel } from "./reviewItems/support";

export interface OpeningMark {
  x: number;
  y: number;
}

/** One round's opening duel: the first enemy kill after freeze. */
export interface OpeningDuelRow {
  round: number;
  roundLabel: string;
  tick: number;
  killer: string;
  victim: string;
  killerIndex: number;
  victimIndex: number;
  /** Pretty weapon name, with " HS" on a headshot. */
  weapon: string;
  /** Killer's side at the kill tick. */
  side: Side;
  /** Whether the killer's team won the round. Null when the round has no winner. */
  teamWon: boolean | null;
  /**
   * Attacker and victim world positions for the radar FK/FD marker.
   * Null when the kill has no drawable line (missing coords or overlap).
   */
  marks: { attacker: OpeningMark; victim: OpeningMark } | null;
}

/**
 * Opening duel of every competitive round: the first enemy kill after freeze,
 * either side. Knife rounds, teamkills, and suicides are not openings — the
 * same rule as the radar FK marker and player review.
 */
export function openingDuels(replay: Replay): OpeningDuelRow[] {
  const rows: OpeningDuelRow[] = [];
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const kill = openingDuel(replay, round, round.end_tick);
    if (!kill) continue;
    const side = currentSide(replay, kill.attacker, kill.tick);
    const ends = killLineEnds(replay, kill);
    rows.push({
      round: round.number,
      roundLabel: roundLabel(round),
      tick: kill.tick,
      killer: attackerLabel(replay, kill.attacker),
      victim: playerLabel(replay.players[kill.victim], "?"),
      killerIndex: kill.attacker,
      victimIndex: kill.victim,
      weapon: prettyWeapon(kill.weapon) + (kill.headshot ? " HS" : ""),
      side,
      teamWon: round.winner == null ? null : round.winner === side,
      marks: ends ? { attacker: ends.from, victim: ends.to } : null,
    });
  }
  return rows;
}
