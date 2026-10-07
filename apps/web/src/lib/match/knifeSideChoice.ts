import { samplePlayers } from "@/lib/replay/sample";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import { currentSide } from "@/lib/stats/liveScore";

/**
 * Where the knife winner lined up in round 1.
 * `choice` compares that team's side in K with their side in R1.
 * It is not the side they played to win the knife.
 */
export interface KnifeSideChoice {
  winnerTeam: string;
  winnerSideInK: Side;
  sideInR1: Side;
  choice: "stay" | "switch";
}

/** Null when there is no knife round, it has no winner, or R1's side cannot be told. */
export function knifeSideChoice(replay: Replay): KnifeSideChoice | null {
  const knife = replay.rounds.find((round) => round.is_knife);
  if (!knife?.winner) return null;
  const r1 = competitiveRoundAfterKnife(replay, knife);
  if (!r1) return null;

  const winnerSideInK = knife.winner;
  const winnerTeam = teamName(knife, winnerSideInK);
  const sideInR1 = sideInRoundOne(replay, knife, r1, winnerSideInK, winnerTeam);
  if (!sideInR1) return null;
  return {
    winnerTeam,
    winnerSideInK,
    sideInR1,
    choice: sideInR1 === winnerSideInK ? "stay" : "switch",
  };
}

/** K chip title. "Knife" when that round has no winner. */
export function knifeChipTitle(replay: Replay, round: Round): string {
  if (!round.winner) return "Knife";
  const team = teamName(round, round.winner);
  const won = team === "" ? `won by ${round.winner}` : `won by ${team} (${round.winner})`;
  const choice = knifeSideChoice(replay);
  if (!choice) return `Knife · ${won}`;
  return `Knife · ${won} · picked ${choice.sideInR1} (${choice.choice})`;
}

function competitiveRoundAfterKnife(replay: Replay, knife: Round): Round | null {
  const numbered = replay.rounds.find((round) => !round.is_knife && round.number === 1);
  if (numbered) return numbered;
  return (
    replay.rounds.find((round) => !round.is_knife && round.start_tick > knife.start_tick) ?? null
  );
}

function teamName(round: Round, side: Side): string {
  const raw = side === "CT" ? round.team_ct : round.team_t;
  return raw?.trim() ?? "";
}

function distinctTeamNames(round: Round): boolean {
  const ct = teamName(round, "CT");
  const t = teamName(round, "T");
  return ct !== "" && t !== "" && ct !== t;
}

function sideNamed(round: Round, team: string): Side | null {
  if (team === "") return null;
  const ct = teamName(round, "CT");
  const t = teamName(round, "T");
  if (ct === team && t !== team) return "CT";
  if (t === team && ct !== team) return "T";
  return null;
}

function sideInRoundOne(
  replay: Replay,
  knife: Round,
  r1: Round,
  winnerSideInK: Side,
  winnerTeam: string,
): Side | null {
  if (distinctTeamNames(knife)) {
    const named = sideNamed(r1, winnerTeam);
    if (named) return named;
  }
  return sideFromPlayers(replay, knife, r1, winnerSideInK);
}

function roundSampleTick(round: Round): number {
  return round.freeze_end_tick > 0 ? round.freeze_end_tick : round.start_tick;
}

function presentSide(replay: Replay, player: number, tick: number): Side | null {
  const snap = samplePlayers(replay, tick)[player];
  if (!snap?.present) return null;
  return currentSide(replay, player, tick);
}

function opposite(side: Side): Side {
  return side === "CT" ? "T" : "CT";
}

/** Winner's side in R1 from who was on the winning side at the two freezes. */
function sideFromPlayers(
  replay: Replay,
  knife: Round,
  r1: Round,
  winnerSideInK: Side,
): Side | null {
  const knifeTick = roundSampleTick(knife);
  const r1Tick = roundSampleTick(r1);
  let stayed = 0;
  let switched = 0;
  for (const player of replay.players) {
    if (presentSide(replay, player.index, knifeTick) !== winnerSideInK) continue;
    const later = presentSide(replay, player.index, r1Tick);
    if (!later) continue;
    if (later === winnerSideInK) stayed += 1;
    else switched += 1;
  }
  if (stayed === 0 && switched === 0) return null;
  if (stayed === switched) return null;
  return stayed > switched ? winnerSideInK : opposite(winnerSideInK);
}
