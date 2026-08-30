import { findExecutes, type ExecuteBeat } from "@/lib/match/execute";
import { calloutsInLocation, type MapPlaces } from "@/lib/match/sites";
import { utilityThrough, type UtilThrowRow } from "@/lib/match/utility";
import type { DemoSeries } from "@/lib/parse/session";
import { playerIdentityKey } from "@/lib/parse/seriesRoster";
import { tagSeries, type RoundKind, type RoundTag } from "@/lib/parse/roundTags";
import { samplePlayer } from "@/lib/replay/sample";
import type { GrenadeKind, Replay, Side } from "@/lib/replay/replayTypes";
import type { MapLayout } from "@/lib/radar/layouts";

export interface SeriesFilter {
  side?: Side;
  kind?: RoundKind;
  layoutGroup?: string;
}

export function matchingTags(tags: RoundTag[], filter: SeriesFilter): RoundTag[] {
  return tags.filter((tag) => {
    if (filter.side && tag.sideForFocal !== filter.side) return false;
    if (filter.kind && tag.kind !== filter.kind) return false;
    if (filter.layoutGroup && tag.layoutGroup !== filter.layoutGroup) return false;
    return true;
  });
}

function roundEndTick(replay: Replay, tag: RoundTag): number {
  const round = replay.rounds.find((r) => r.number === tag.roundNumber);
  return round?.end_tick ?? tag.freezeEndTick;
}

function utilInTaggedRound(
  replay: Replay,
  tag: RoundTag,
  places: MapPlaces | null,
): UtilThrowRow[] {
  const until = roundEndTick(replay, tag);
  const summary = utilityThrough(replay, until, null, places);
  return summary.throws.filter((row) => row.round === tag.roundNumber);
}

function executesInTaggedRound(
  replay: Replay,
  tag: RoundTag,
  places: MapPlaces | null,
): ExecuteBeat[] {
  return findExecutes(replay, places).filter((beat) => beat.round === tag.roundNumber);
}

function throwerMatchesFilter(
  replay: Replay,
  tag: RoundTag,
  thrower: number,
  playerKey: string | null | undefined,
): boolean {
  if (thrower < 0) return false;
  const wantCt = tag.sideForFocal === "CT";
  const snap = samplePlayer(replay, thrower, tag.freezeEndTick);
  if (!snap?.present || snap.ct !== wantCt) return false;
  if (playerKey && playerIdentityKey(replay, thrower) !== playerKey) return false;
  return true;
}

/** Callout names for a util row (never a layout group label). */
export function calloutsForUtilRow(row: UtilThrowRow): string[] {
  const callouts = calloutsInLocation(row.location);
  if (callouts.length > 0) return callouts;
  if (row.site) return [row.site];
  return ["?"];
}

/** Action beat title with direct callout names instead of layout groups. */
export function seriesActionLabel(beat: ExecuteBeat): string {
  const head = beat.title.includes(" · ") ? beat.title.split(" · ")[0]! : beat.title;
  const callouts = calloutsInLocation(beat.location);
  if (callouts.length > 0) return `${head} · ${callouts.join(", ")}`;
  if (beat.site) return `${head} · ${beat.site}`;
  return beat.title;
}

export interface SeriesUtilAggregate {
  /** Sorted by frequency descending. */
  entries: { callout: string; kind: GrenadeKind; count: number }[];
  roundCount: number;
}

/** Count util by callout across rounds that match the filter bucket. */
export function aggregateSeriesUtil(
  series: DemoSeries,
  tagsByDemo: Map<string, RoundTag[]>,
  filter: SeriesFilter,
  places: MapPlaces | null,
  playerKey: string | null = null,
): SeriesUtilAggregate {
  const counts = new Map<string, { callout: string; kind: GrenadeKind; count: number }>();
  let roundCount = 0;

  for (const demo of series.demos) {
    const tags = tagsByDemo.get(demo.id) ?? [];
    const matched = matchingTags(tags, filter);
    for (const tag of matched) {
      roundCount += 1;
      const rows = utilInTaggedRound(demo.replay, tag, places);
      for (const row of rows) {
        if (!throwerMatchesFilter(demo.replay, tag, row.thrower, playerKey)) continue;
        for (const callout of calloutsForUtilRow(row)) {
          const key = `${row.kind}|${callout}`;
          const prev = counts.get(key);
          if (prev) prev.count += 1;
          else counts.set(key, { callout, kind: row.kind, count: 1 });
        }
      }
    }
  }

  const entries = [...counts.values()].sort(
    (a, b) =>
      b.count - a.count || a.kind.localeCompare(b.kind) || a.callout.localeCompare(b.callout),
  );
  return { entries, roundCount };
}

export interface SeriesActionAggregate {
  entries: { title: string; count: number }[];
  roundCount: number;
}

/** Count execute beats across filter-matched rounds. */
export function aggregateSeriesAction(
  series: DemoSeries,
  tagsByDemo: Map<string, RoundTag[]>,
  filter: SeriesFilter,
  places: MapPlaces | null,
): SeriesActionAggregate {
  const counts = new Map<string, number>();
  let roundCount = 0;

  for (const demo of series.demos) {
    const tags = tagsByDemo.get(demo.id) ?? [];
    const matched = matchingTags(tags, filter);
    for (const tag of matched) {
      roundCount += 1;
      for (const beat of executesInTaggedRound(demo.replay, tag, places)) {
        const title = seriesActionLabel(beat);
        counts.set(title, (counts.get(title) ?? 0) + 1);
      }
    }
  }

  const entries = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { entries, roundCount };
}

export interface SeriesUtilThrow extends UtilThrowRow {
  demoId: string;
  fileName: string;
  jumpTick: number;
}

/** All focal-team util throws in filter-matched rounds (optional player filter). */
export function collectSeriesUtilThrows(
  series: DemoSeries,
  tagsByDemo: Map<string, RoundTag[]>,
  filter: SeriesFilter,
  places: MapPlaces | null,
  playerKey: string | null = null,
): SeriesUtilThrow[] {
  const out: SeriesUtilThrow[] = [];

  for (const demo of series.demos) {
    const tags = tagsByDemo.get(demo.id) ?? [];
    for (const tag of matchingTags(tags, filter)) {
      for (const row of utilInTaggedRound(demo.replay, tag, places)) {
        if (!throwerMatchesFilter(demo.replay, tag, row.thrower, playerKey)) continue;
        out.push({
          ...row,
          demoId: demo.id,
          fileName: demo.fileName,
          jumpTick: row.tick,
        });
      }
    }
  }

  return out.sort(
    (a, b) =>
      a.fileName.localeCompare(b.fileName) ||
      a.round - b.round ||
      a.tick - b.tick ||
      a.kind.localeCompare(b.kind),
  );
}

export interface SeriesActionBeatRow {
  beat: ExecuteBeat;
  demoId: string;
  fileName: string;
  jumpTick: number;
  title: string;
}

export interface AggregatedRoundRow {
  demoId: string;
  fileName: string;
  roundNumber: number;
  roundLabel: string;
  kind: RoundKind;
  side: Side;
  jumpTick: number;
}

/** Filter-matched rounds across every demo in a series (for habits bucket summaries). */
export function collectAggregatedRounds(
  series: DemoSeries,
  filter: SeriesFilter,
): AggregatedRoundRow[] {
  const out: AggregatedRoundRow[] = [];

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    for (const tag of matchingTags(tags, filter)) {
      out.push(roundRowFromTag(demo, tag));
    }
  }

  return out.sort((a, b) => a.fileName.localeCompare(b.fileName) || a.roundNumber - b.roundNumber);
}

export interface SeriesRoundChip {
  demoId: string;
  roundNumber: number;
  kind: RoundKind;
  side: Side;
  jumpTick: number;
  /** 1-based index within the buy bucket across all demos. */
  indexInKind: number;
}

export interface SeriesRoundsByKind {
  kind: RoundKind;
  label: string;
  rounds: SeriesRoundChip[];
}

const KIND_ORDER: RoundKind[] = ["pistol", "eco", "force", "full"];

const KIND_LABEL: Record<RoundKind, string> = {
  pistol: "Pistol",
  eco: "Eco",
  force: "Force",
  full: "Full",
};

const SIDE_ORDER: Record<Side, number> = { CT: 0, T: 1 };

function sortRowsForAggregatedStrip(a: AggregatedRoundRow, b: AggregatedRoundRow): number {
  return (
    SIDE_ORDER[a.side] - SIDE_ORDER[b.side] ||
    a.fileName.localeCompare(b.fileName) ||
    a.roundNumber - b.roundNumber
  );
}

function chipsFromSortedRows(sorted: AggregatedRoundRow[]): SeriesRoundChip[] {
  let ctIndex = 0;
  let tIndex = 0;
  return sorted.map((row) => ({
    demoId: row.demoId,
    roundNumber: row.roundNumber,
    kind: row.kind,
    side: row.side,
    jumpTick: row.jumpTick,
    indexInKind: row.side === "CT" ? ++ctIndex : ++tIndex,
  }));
}

function roundRowFromTag(demo: DemoSeries["demos"][number], tag: RoundTag): AggregatedRoundRow {
  const round = demo.replay.rounds.find((r) => r.number === tag.roundNumber);
  const roundLabel = round?.is_knife ? "Knife" : `R${tag.roundNumber}`;
  return {
    demoId: demo.id,
    fileName: demo.fileName,
    roundNumber: tag.roundNumber,
    roundLabel,
    kind: tag.kind,
    side: tag.sideForFocal,
    jumpTick: tag.freezeEndTick,
  };
}

/** All focal-team rounds in a series, grouped by buy type for aggregated GOTV navigation. */
export function collectSeriesRoundsByKind(series: DemoSeries): SeriesRoundsByKind[] {
  const buckets = new Map<RoundKind, AggregatedRoundRow[]>();
  for (const kind of KIND_ORDER) buckets.set(kind, []);

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    for (const tag of tags) {
      buckets.get(tag.kind)?.push(roundRowFromTag(demo, tag));
    }
  }

  return KIND_ORDER.map((kind) => {
    const sorted = (buckets.get(kind) ?? []).sort(sortRowsForAggregatedStrip);
    return {
      kind,
      label: KIND_LABEL[kind],
      rounds: chipsFromSortedRows(sorted),
    };
  }).filter((group) => group.rounds.length > 0);
}

/** Execute beats across filter-matched rounds with demo jump targets. */
export function collectSeriesActionBeats(
  series: DemoSeries,
  tagsByDemo: Map<string, RoundTag[]>,
  filter: SeriesFilter,
  places: MapPlaces | null,
): SeriesActionBeatRow[] {
  const out: SeriesActionBeatRow[] = [];

  for (const demo of series.demos) {
    const tags = tagsByDemo.get(demo.id) ?? [];
    for (const tag of matchingTags(tags, filter)) {
      for (const beat of executesInTaggedRound(demo.replay, tag, places)) {
        out.push({
          beat,
          demoId: demo.id,
          fileName: demo.fileName,
          jumpTick: beat.tick,
          title: seriesActionLabel(beat),
        });
      }
    }
  }

  return out.sort(
    (a, b) =>
      a.fileName.localeCompare(b.fileName) ||
      a.beat.round - b.beat.round ||
      a.beat.actionTick - b.beat.actionTick,
  );
}

export function buildSeriesTags(series: DemoSeries): Map<string, RoundTag[]> {
  return tagSeries(series.demos, series.focalTeamNames);
}

export function seriesTagsForDemo(tagsByDemo: Map<string, RoundTag[]>, demoId: string): RoundTag[] {
  return tagsByDemo.get(demoId) ?? [];
}

/** Layout groups referenced on tags (for filter chips later). */
export function seriesLayoutGroups(tagsByDemo: Map<string, RoundTag[]>): string[] {
  const groups = new Set<string>();
  for (const tags of tagsByDemo.values()) {
    for (const tag of tags) {
      if (tag.layoutGroup) groups.add(tag.layoutGroup);
    }
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

/** Re-export for callers that need layout typing without importing radar. */
export type { MapLayout };
