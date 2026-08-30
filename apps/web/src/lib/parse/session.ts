import type { Replay } from "@/lib/replay/replayTypes";
import { tagSeries, type RoundTag } from "./roundTags";
import {
  aliasesForTeamName,
  mergeSeriesTeamCandidates,
  type SeriesTeamCandidate,
} from "./seriesTeams";

/**
 * One parsed GOTV file. The viewer plays a single active demo today.
 * Multi-demo overlay (same map, freeze-relative trails/nades) stacks more of these
 * keyed by Steam ID + round index, not raw ticks.
 */
export interface LoadedDemo {
  id: string;
  replay: Replay;
  fileName: string;
  /** Browser `File` handle for reload / retry (bytes are not duplicated). */
  file: File;
}

/** Several same-map demos parsed for habits / series analysis. */
export interface DemoSeries {
  mapName: string;
  demos: LoadedDemo[];
  /** Canonical team label in the habits UI. */
  focalTeam: string;
  /** Header spellings for the focal team (e.g. Spirit + Team Spirit). */
  focalTeamNames: readonly string[];
  /** Built once at parse time; switching files does not re-tag. */
  tagsByDemo: Map<string, RoundTag[]>;
}

/** Stable per-file id within a series (filename alone collides for GOTV drops). */
export function demoId(fileName: string, mapName: string, file?: File): string {
  if (file) {
    return `${mapName}|${fileName}|${file.size}|${file.lastModified}`;
  }
  return `${mapName}|${fileName}`;
}

export function loadedDemo(replay: Replay, fileName: string, file: File): LoadedDemo {
  return { id: demoId(fileName, replay.header.map_name, file), replay, fileName, file };
}

/** Team name that appears in every demo (either side). Falls back to first demo CT. */
export function inferFocalTeam(demos: LoadedDemo[]): string {
  return defaultFocalTeam(demos);
}

/** Teams in the series ranked by how many demos include them (aliases merged). */
export function seriesTeamCandidates(demos: LoadedDemo[]): SeriesTeamCandidate[] {
  return mergeSeriesTeamCandidates(demos);
}

/** Default habits team: the name that shows up in the most demos. */
export function defaultFocalTeam(demos: LoadedDemo[]): string {
  const candidates = seriesTeamCandidates(demos);
  if (candidates.length === 0) return demos[0]?.replay.header.team_ct ?? "";
  const max = candidates[0].demoCount;
  const tied = candidates.filter((c) => c.demoCount === max);
  if (tied.length === 1) return tied[0].name;
  const first = demos[0].replay.header;
  for (const group of tied) {
    if (group.aliases.includes(first.team_ct)) return group.name;
  }
  for (const group of tied) {
    if (group.aliases.includes(first.team_t)) return group.name;
  }
  return tied[0].name;
}

function focalNamesFor(demos: LoadedDemo[], focalTeam: string): readonly string[] {
  return aliasesForTeamName(demos, focalTeam);
}

/** Canonical habits label for a header team name in this series. */
export function canonicalSeriesTeam(series: DemoSeries, teamName: string): string {
  return (
    seriesTeamCandidates(series.demos).find(
      (c) => c.name === teamName || c.aliases.includes(teamName),
    )?.name ?? teamName
  );
}

export function buildSeries(mapName: string, demos: LoadedDemo[], focalTeam?: string): DemoSeries {
  const team = focalTeam ?? defaultFocalTeam(demos);
  const focalTeamNames = focalNamesFor(demos, team);
  const canonical =
    seriesTeamCandidates(demos).find((c) => c.name === team || c.aliases.includes(team))?.name ??
    team;
  return {
    mapName,
    demos,
    focalTeam: canonical,
    focalTeamNames,
    tagsByDemo: tagSeries(demos, focalTeamNames),
  };
}

export function withFocalTeam(series: DemoSeries, focalTeam: string): DemoSeries {
  const focalTeamNames = focalNamesFor(series.demos, focalTeam);
  const canonical =
    seriesTeamCandidates(series.demos).find(
      (c) => c.name === focalTeam || c.aliases.includes(focalTeam),
    )?.name ?? focalTeam;
  if (series.focalTeam === canonical && series.focalTeamNames.join() === focalTeamNames.join()) {
    return series;
  }
  return {
    ...series,
    focalTeam: canonical,
    focalTeamNames,
    tagsByDemo: tagSeries(series.demos, focalTeamNames),
  };
}
