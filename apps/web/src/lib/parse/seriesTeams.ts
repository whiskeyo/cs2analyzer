import { samplePlayers } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { SERIES_TEAM_MERGE_MIN_STEAM_OVERLAP } from "@/lib/shared/constants";
import type { LoadedDemo } from "./session";

export interface SeriesTeamCandidate {
  /** Preferred label in the team picker. */
  name: string;
  demoCount: number;
  /** Header spellings merged into this entry (includes `name`). */
  aliases: string[];
}

/** Roster Steam IDs for a team name at the first competitive freeze where it appears. */
export function teamRosterInDemo(replay: Replay, teamName: string): Set<number> {
  const ids = new Set<number>();
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const ct = round.team_ct ?? replay.header.team_ct;
    const t = round.team_t ?? replay.header.team_t;
    const onCt = ct === teamName;
    const onT = t === teamName;
    if (!onCt && !onT) continue;
    const wantCt = onCt;

    const tick = round.freeze_end_tick || round.start_tick;
    for (const p of samplePlayers(replay, tick)) {
      if (!p.present || p.ct !== wantCt) continue;
      const steamId = replay.players[p.index]?.steam_id ?? 0;
      if (steamId > 0) ids.add(steamId);
    }
    if (ids.size > 0) return ids;
  }
  return ids;
}

function unionRoster(demos: LoadedDemo[], teamName: string): Set<number> {
  const ids = new Set<number>();
  for (const demo of demos) {
    for (const id of teamRosterInDemo(demo.replay, teamName)) ids.add(id);
  }
  return ids;
}

function demoIdsForTeam(demos: LoadedDemo[], teamName: string): Set<string> {
  const out = new Set<string>();
  for (const demo of demos) {
    const header = demo.replay.header;
    if (header.team_ct === teamName || header.team_t === teamName) out.add(demo.id);
  }
  return out;
}

function rosterOverlap(a: Set<number>, b: Set<number>): number {
  let n = 0;
  for (const id of a) {
    if (b.has(id)) n += 1;
  }
  return n;
}

/** True when `long` is "Team {short}" (FACEIT-style prefixed roster names). */
export function teamPrefixPair(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long === `Team ${short}`;
}

function pickCanonicalName(a: string, b: string, demoCountA: number, demoCountB: number): string {
  if (demoCountA !== demoCountB) return demoCountA > demoCountB ? a : b;
  return a.length >= b.length ? a : b;
}

/** Raw team names from headers, grouped when rosters match (e.g. Spirit + Team Spirit). */
export function mergeSeriesTeamCandidates(demos: LoadedDemo[]): SeriesTeamCandidate[] {
  const rawNames = new Set<string>();
  for (const demo of demos) {
    rawNames.add(demo.replay.header.team_ct);
    rawNames.add(demo.replay.header.team_t);
  }

  const groups: SeriesTeamCandidate[] = [...rawNames].filter(Boolean).map((name) => ({
    name,
    demoCount: demoIdsForTeam(demos, name).size,
    aliases: [name],
  }));

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        if (!teamPrefixPair(a.name, b.name)) continue;

        const overlap = rosterOverlap(unionRoster(demos, a.name), unionRoster(demos, b.name));
        if (overlap < SERIES_TEAM_MERGE_MIN_STEAM_OVERLAP) continue;

        const demoIds = new Set<string>();
        for (const alias of [...a.aliases, ...b.aliases]) {
          for (const id of demoIdsForTeam(demos, alias)) demoIds.add(id);
        }
        const canonical = pickCanonicalName(a.name, b.name, a.demoCount, b.demoCount);
        const aliases = [...new Set([...a.aliases, ...b.aliases])].sort((x, y) =>
          x.localeCompare(y),
        );
        groups.splice(j, 1);
        groups[i] = { name: canonical, demoCount: demoIds.size, aliases };
        merged = true;
        break outer;
      }
    }
  }

  return groups.sort((a, b) => b.demoCount - a.demoCount || a.name.localeCompare(b.name));
}

export function aliasesForTeamName(demos: LoadedDemo[], selected: string): readonly string[] {
  for (const group of mergeSeriesTeamCandidates(demos)) {
    if (group.name === selected || group.aliases.includes(selected)) return group.aliases;
  }
  return [selected];
}
