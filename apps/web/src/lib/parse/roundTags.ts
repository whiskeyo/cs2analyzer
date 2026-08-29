import { samplePlayers } from "@/lib/replay/sample";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import {
  ECO_MAX_EQUIPMENT,
  FIRST_OVERTIME_ROUND,
  FORCE_BUY_MAX_EQUIPMENT,
  REGULATION_ROUNDS,
} from "@/lib/shared/constants";

export type RoundKind = "pistol" | "eco" | "force" | "full";

/** Aligned round bucket for series filters — never keyed by raw round number alone. */
export interface RoundTag {
  demoId: string;
  roundNumber: number;
  startTick: number;
  freezeEndTick: number;
  sideForFocal: Side;
  kind: RoundKind;
  isOt: boolean;
  layoutGroup?: string;
}

export function demoHasFocalTeam(replay: Replay, focalTeamName: string): boolean {
  return (
    replay.header.team_ct === focalTeamName || replay.header.team_t === focalTeamName
  );
}

function teamNames(replay: Replay, round: Round): { ct: string; t: string } {
  return {
    ct: round.team_ct ?? replay.header.team_ct,
    t: round.team_t ?? replay.header.team_t,
  };
}

/** Focal team's side at freeze. Null when that roster is not in the match. */
export function focalSideAtFreeze(
  replay: Replay,
  round: Round,
  focalTeamName: string,
): Side | null {
  const { ct, t } = teamNames(replay, round);
  if (ct === focalTeamName) return "CT";
  if (t === focalTeamName) return "T";
  return null;
}

function buyKindForSide(replay: Replay, tick: number, ct: boolean): RoundKind {
  const players = samplePlayers(replay, tick).filter((p) => p.present && p.ct === ct);
  if (players.length === 0) return "eco";
  const avg = players.reduce((sum, p) => sum + p.equip, 0) / players.length;
  if (avg < ECO_MAX_EQUIPMENT) return "eco";
  if (avg < FORCE_BUY_MAX_EQUIPMENT) return "force";
  return "full";
}

function isOvertime(round: Round): boolean {
  return round.number >= FIRST_OVERTIME_ROUND;
}

function isRegulation(round: Round): boolean {
  return round.number >= 1 && round.number <= REGULATION_ROUNDS;
}

/**
 * Tag every competitive round for series filters. Knife rounds are omitted.
 * Pistol = first regulation round on each focal side (not round number).
 * OT rounds use eco / force / full only.
 */
export function tagRounds(
  replay: Replay,
  demoId: string,
  focalTeamName: string,
): RoundTag[] {
  if (!demoHasFocalTeam(replay, focalTeamName)) return [];

  const tags: RoundTag[] = [];
  const pistolSeen: Record<Side, boolean> = { T: false, CT: false };

  for (const round of replay.rounds) {
    if (round.is_knife) continue;

    const sideForFocal = focalSideAtFreeze(replay, round, focalTeamName);
    if (!sideForFocal) continue;

    const freeze = round.freeze_end_tick || round.start_tick;
    const ot = isOvertime(round);

    let kind: RoundKind;
    if (ot) {
      kind = buyKindForSide(replay, freeze, sideForFocal === "CT");
    } else if (isRegulation(round) && !pistolSeen[sideForFocal]) {
      kind = "pistol";
      pistolSeen[sideForFocal] = true;
    } else {
      kind = buyKindForSide(replay, freeze, sideForFocal === "CT");
    }

    tags.push({
      demoId,
      roundNumber: round.number,
      startTick: round.start_tick,
      freezeEndTick: freeze,
      sideForFocal,
      kind,
      isOt: ot,
    });
  }

  return tags;
}

/** Tags for every demo in a series, keyed by demo id. */
export function tagSeries(
  demos: { id: string; replay: Replay }[],
  focalTeamName: string,
): Map<string, RoundTag[]> {
  const out = new Map<string, RoundTag[]>();
  for (const demo of demos) {
    out.set(demo.id, tagRounds(demo.replay, demo.id, focalTeamName));
  }
  return out;
}
