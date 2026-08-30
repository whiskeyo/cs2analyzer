import { samplePlayer, samplePlayers } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { liveTeams } from "@/lib/stats/stats";
import type { DemoSeries, LoadedDemo } from "./session";
import { demoHasFocalTeam, focalSideAtFreeze } from "./roundTags";

/** Player slot index for a habits roster key, or null when absent from this demo. */
export function playerIndexForKey(replay: Replay, playerKey: string): number | null {
  for (let i = 0; i < replay.players.length; i++) {
    if (playerIdentityKey(replay, i) === playerKey) return i;
  }
  return null;
}

/** Stable player key for habits overlay (Steam ID when present). */
export function playerIdentityKey(replay: Replay, playerIndex: number): string {
  const meta = replay.players[playerIndex];
  if (!meta) return `idx:${playerIndex}`;
  if (meta.steam_id > 0) return `steam:${meta.steam_id}`;
  return `name:${meta.name}:${playerIndex}`;
}

/** Team name for a player at the current tick (follows side swaps). */
export function playerTeamNameAt(replay: Replay, player: number, tick: number): string | null {
  const snap = samplePlayer(replay, player, tick);
  if (!snap?.present) return null;
  const teams = liveTeams(replay, tick);
  return snap.ct ? teams.ctName : teams.tName;
}

function rosterFromDemo(demo: LoadedDemo, focalTeamNames: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const replay = demo.replay;
  if (!demoHasFocalTeam(replay, focalTeamNames)) return out;

  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const side = focalSideAtFreeze(replay, round, focalTeamNames);
    if (!side) continue;
    const tick = round.freeze_end_tick || round.start_tick;
    const wantCt = side === "CT";
    for (const p of samplePlayers(replay, tick)) {
      if (!p.present || p.ct !== wantCt) continue;
      const key = playerIdentityKey(replay, p.index);
      if (!out.has(key)) out.set(key, replay.players[p.index]?.name ?? "?");
    }
  }
  return out;
}

/** Focal-team players seen across the series (union by Steam ID / name key). */
export function focalRosterForSeries(series: DemoSeries): { key: string; name: string }[] {
  const byKey = new Map<string, string>();
  for (const demo of series.demos) {
    for (const [key, name] of rosterFromDemo(demo, series.focalTeamNames)) {
      if (!byKey.has(key)) byKey.set(key, name);
    }
  }
  return [...byKey.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
