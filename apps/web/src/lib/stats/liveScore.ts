import { COMPETITIVE_PLAYERS_PER_SIDE } from "@/lib/shared/constants";
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

/**
 * Live scoreboard / eco strip: GOTV can keep a leftover controller `present`
 * after a leave (`m_iConnected` omitted → parser still samples). Hide a $0
 * dead leftover who was not alive at this freeze. Eco deaths stay: they were
 * alive at freeze. Mid-round reconnect shows once they are alive or have money.
 */
export function onLiveScoreboard(replay: Replay, player: number, tick: number): boolean {
  const snap = samplePlayers(replay, tick)[player];
  if (!snap?.present) return false;
  if (snap.alive || snap.money > 0) return true;
  const round = currentRound(replay, tick);
  if (!round) return true;
  const freeze = round.freeze_end_tick > 0 ? round.freeze_end_tick : round.start_tick;
  const atFreeze = samplePlayers(replay, freeze)[player];
  return atFreeze?.present === true && atFreeze.alive === true;
}

function missedThisFreeze(replay: Replay, player: number, tick: number): boolean {
  const round = currentRound(replay, tick);
  if (!round) return false;
  const freeze = round.freeze_end_tick > 0 ? round.freeze_end_tick : round.start_tick;
  const atFreeze = samplePlayers(replay, freeze)[player];
  return !(atFreeze?.present === true && atFreeze.alive === true);
}

/**
 * After `onLiveScoreboard`, a leftover can still be present+alive+$0 (GOTV
 * spawned the controller). If a side then has more than 5, drop $0 players
 * who missed this freeze — that is the 6v4 KatolikCOO row.
 */
export function liveScoreboardPlayers(replay: Replay, tick: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < replay.players.length; i++) {
    if (onLiveScoreboard(replay, i, tick)) ids.push(i);
  }
  const sampled = samplePlayers(replay, tick);
  const bySide: Record<Side, number[]> = { CT: [], T: [] };
  for (const i of ids) {
    bySide[currentSide(replay, i, tick)].push(i);
  }
  const out: number[] = [];
  for (const side of ["CT", "T"] as const) {
    let list = bySide[side];
    while (list.length > COMPETITIVE_PLAYERS_PER_SIDE) {
      let best: number | null = null;
      let bestScore = 0;
      for (const i of list) {
        if (replay.players[i]?.is_bot) continue;
        if ((sampled[i]?.money ?? 0) > 0) continue;
        let score = 4;
        if (missedThisFreeze(replay, i, tick)) score += 2;
        if (sampled[i]?.alive !== true) score += 1;
        if (score > bestScore || (score === bestScore && (best == null || i > best))) {
          best = i;
          bestScore = score;
        }
      }
      if (best == null) break;
      list = list.filter((i) => i !== best);
    }
    out.push(...list);
  }
  return out;
}
