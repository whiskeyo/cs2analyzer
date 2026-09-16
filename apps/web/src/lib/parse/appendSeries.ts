import { groupParsedDemosByMap } from "./parsePool";
import { buildSeries, type DemoSeries, type LoadedDemo } from "./session";

/** Same-map stack used by the series bar and map picker. */
export interface SeriesMapGroup {
  mapName: string;
  demos: LoadedDemo[];
}

export interface SessionSnapshot {
  demo: LoadedDemo | null;
  series: DemoSeries | null;
  parsedDemos: LoadedDemo[];
  mapGroups: SeriesMapGroup[];
}

/** Demos already in the open session, across every map group. */
export function existingSessionDemos(session: SessionSnapshot): LoadedDemo[] {
  if (session.parsedDemos.length > 0) return session.parsedDemos;
  if (session.mapGroups.length > 0) return session.mapGroups.flatMap((group) => group.demos);
  if (session.series) return [...session.series.demos];
  return session.demo ? [session.demo] : [];
}

export function loadedSessionCount(session: SessionSnapshot): number {
  return existingSessionDemos(session).length;
}

export function groupLoadedDemosByMap(demos: LoadedDemo[]): SeriesMapGroup[] {
  return groupParsedDemosByMap(demos.map((demo) => ({ file: demo.file, demo }))).groups;
}

export function duplicateSeriesNotice(fileName: string): string {
  return `${fileName} is already in this series.`;
}

/** Same sentence as a multi-file drop, keyed to the active map. */
export function formatSeriesNotice(groups: SeriesMapGroup[], series: DemoSeries): string {
  const primary = groups.find((group) => group.mapName === series.mapName) ?? groups[0];
  if (!primary) return "";
  const mapSummary =
    groups.length > 1
      ? `${groups.length} maps (${groups.map((g) => `${g.demos.length}× ${g.mapName}`).join(", ")})`
      : primary.mapName;
  return `Series: ${primary.demos.length} ${primary.mapName} demo${primary.demos.length === 1 ? "" : "s"} · ${series.focalTeam}${groups.length > 1 ? ` · ${mapSummary}` : ""}`;
}

export interface MergeAppendedDemosInput {
  existing: LoadedDemo[];
  incoming: LoadedDemo[];
  currentMapName: string;
  currentDemoId: string | null;
  /** Keep the user's habits team when folding into an existing series. */
  focalTeam?: string;
}

export interface MergeAppendedDemosResult {
  groups: SeriesMapGroup[];
  parsedDemos: LoadedDemo[];
  selectedMapName: string;
  series: DemoSeries;
  demo: LoadedDemo;
  added: LoadedDemo[];
  duplicates: LoadedDemo[];
}

/**
 * Fold newly parsed demos into an open session. Same-map files join the
 * active series; other maps become extra picker groups (mixed initial drop).
 * The current file stays selected so notes and the playhead are not reset.
 */
export function mergeAppendedDemos(input: MergeAppendedDemosInput): MergeAppendedDemosResult {
  const seen = new Set(input.existing.map((demo) => demo.id));
  const duplicates: LoadedDemo[] = [];
  const added: LoadedDemo[] = [];
  for (const demo of input.incoming) {
    if (seen.has(demo.id)) {
      duplicates.push(demo);
      continue;
    }
    seen.add(demo.id);
    added.push(demo);
  }

  const parsedDemos = [...input.existing, ...added];
  const groups = groupLoadedDemosByMap(parsedDemos);
  const selectedMapName = groups.some((group) => group.mapName === input.currentMapName)
    ? input.currentMapName
    : (groups[0]?.mapName ?? input.currentMapName);
  const selectedGroup = groups.find((group) => group.mapName === selectedMapName) ?? groups[0];
  if (!selectedGroup) {
    throw new Error("mergeAppendedDemos requires at least one demo");
  }
  const series = buildSeries(selectedMapName, selectedGroup.demos, input.focalTeam);
  const demo =
    selectedGroup.demos.find((row) => row.id === input.currentDemoId) ?? selectedGroup.demos[0];

  return {
    groups,
    parsedDemos,
    selectedMapName,
    series,
    demo,
    added,
    duplicates,
  };
}
