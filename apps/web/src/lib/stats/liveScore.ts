import { currentRound, samplePlayers } from "@/lib/replay/sample";
import type { Replay, Side } from "@/lib/replay/replayTypes";
import { roundSidesSwapped, winnerStartingSide } from "./scorecard";

/** Match wins for whoever is currently on CT / T at `tick`. */
export function liveScore(replay: Replay, tick: number): { ct: number; t: number } {
  let startCt = 0;
  let startT = 0;
  for (const r of replay.rounds) {
    if (r.is_knife || r.end_tick > tick) {
      continue;
    }
    const start = winnerStartingSide(replay, r);
    if (start === "CT") {
      startCt += 1;
    } else if (start === "T") {
      startT += 1;
    }
  }
  const round = currentRound(replay, tick);
  const swapped = round ? roundSidesSwapped(replay, round) : false;
  return swapped ? { ct: startT, t: startCt } : { ct: startCt, t: startT };
}

export interface LiveTeams {
  ct: number;
  t: number;
  ctName: string;
  tName: string;
}

let teamsCache: { replay: Replay; tick: number; teams: LiveTeams } | null = null;

/**
 * Team names and scores for the sides currently playing CT / T. Cached like
 * `computeStats`: the HUD, the scoreboard and the economy strip all ask for the
 * same tick, and each call tallies every round.
 */
export function liveTeams(replay: Replay, tick: number): LiveTeams {
  const t = Math.floor(tick);
  if (teamsCache && teamsCache.replay === replay && teamsCache.tick === t) {
    return teamsCache.teams;
  }
  const teams = computeLiveTeams(replay, tick);
  teamsCache = { replay, tick: t, teams };
  return teams;
}

function computeLiveTeams(replay: Replay, tick: number): LiveTeams {
  const score = liveScore(replay, tick);
  const round = currentRound(replay, tick);
  const swapped = round ? roundSidesSwapped(replay, round) : false;
  const ctName =
    round?.team_ct || (swapped ? replay.header.team_t || "T" : replay.header.team_ct || "CT");
  const tName =
    round?.team_t || (swapped ? replay.header.team_ct || "CT" : replay.header.team_t || "T");
  return { ...score, ctName, tName };
}

export function currentSide(replay: Replay, player: number, tick: number): Side {
  const snap = samplePlayers(replay, tick)[player];
  if (!snap?.present) {
    return replay.players[player]?.start_side ?? "T";
  }
  return snap.ct ? "CT" : "T";
}
