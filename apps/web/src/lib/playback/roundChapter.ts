import { samplePlayers } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import {
  ECO_MAX_EQUIPMENT,
  FIRST_OVERTIME_ROUND,
  FORCE_BUY_MAX_EQUIPMENT,
  REGULATION_ROUNDS_PER_HALF,
} from "@/lib/shared/constants";

/**
 * Chapter shown above a round chip.
 *
 * Order is first match wins:
 * - `knife` — `round.is_knife`
 * - `pistol` — regulation round 1 or 13. Current CS2 overtime pays a full
 *   buy (`OVERTIME_START_MONEY`), so OT block starts are not pistols here.
 *   Series filters still use `isPistolRoundNumber`, which does flag them.
 * - `eco` / `force` — poorer side's average equipment at freeze, using the
 *   same caps as series tags.
 * - `overtime` — an overtime round that is not a clear eco or force (full
 *   buy, or no equipment sample).
 * - `full` — regulation round where every sampled side is at least a full buy.
 * - `null` — regulation round with nobody present at freeze. Do not guess eco.
 */
export type RoundChapter = "knife" | "pistol" | "eco" | "force" | "full" | "overtime";

export const ROUND_CHAPTER_LABEL: Record<RoundChapter, string> = {
  knife: "Knife",
  pistol: "Pistol",
  eco: "Eco",
  force: "Force",
  full: "Full buy",
  overtime: "Overtime",
};

export function isRegulationPistolRound(roundNumber: number): boolean {
  return roundNumber === 1 || roundNumber === REGULATION_ROUNDS_PER_HALF + 1;
}

function freezeTick(round: Round): number {
  return round.freeze_end_tick || round.start_tick;
}

/** Average equipment for one side. Null when that side has nobody present. */
function sideAverageEquip(replay: Replay, tick: number, ct: boolean): number | null {
  const players = samplePlayers(replay, tick).filter(
    (player) => player.present && player.ct === ct,
  );
  if (players.length === 0) return null;
  return players.reduce((sum, player) => sum + player.equip, 0) / players.length;
}

/**
 * Lower of the two side averages. A one-sided save stays eco or force
 * even when the other team is on a full buy.
 */
function poorerSideEquip(replay: Replay, tick: number): number | null {
  const ct = sideAverageEquip(replay, tick, true);
  const t = sideAverageEquip(replay, tick, false);
  if (ct == null) return t;
  if (t == null) return ct;
  return Math.min(ct, t);
}

function buyChapter(average: number): "eco" | "force" | "full" {
  if (average < ECO_MAX_EQUIPMENT) return "eco";
  if (average < FORCE_BUY_MAX_EQUIPMENT) return "force";
  return "full";
}

export function roundChapter(replay: Replay, round: Round): RoundChapter | null {
  if (round.is_knife) return "knife";
  if (isRegulationPistolRound(round.number)) return "pistol";

  const overtime = round.number >= FIRST_OVERTIME_ROUND;
  const average = poorerSideEquip(replay, freezeTick(round));
  if (average == null) return overtime ? "overtime" : null;

  const buy = buyChapter(average);
  if (buy === "eco" || buy === "force") return buy;
  return overtime ? "overtime" : "full";
}
