import { findExecutes, type ExecuteBeat } from "@/lib/match/execute";
import type { MapPlaces } from "@/lib/match/sites";
import {
  usedUtilPlaces,
  utilMatchesPlace,
  utilityThrough,
  type UtilPlaceChip,
  type UtilThrowRow,
} from "@/lib/match/utility";
import type { DemoSeries } from "@/lib/parse/session";
import { tagSeries, type RoundKind, type RoundTag } from "@/lib/parse/roundTags";
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

export interface SeriesUtilAggregate {
  /** Sorted by frequency descending. */
  entries: { chip: UtilPlaceChip; kind: GrenadeKind; count: number }[];
  roundCount: number;
}

/** Count util chips across rounds that match the filter bucket. */
export function aggregateSeriesUtil(
  series: DemoSeries,
  tagsByDemo: Map<string, RoundTag[]>,
  filter: SeriesFilter,
  places: MapPlaces | null,
): SeriesUtilAggregate {
  const layout = places?.layout ?? null;
  const counts = new Map<string, { chip: UtilPlaceChip; kind: GrenadeKind; count: number }>();
  let roundCount = 0;

  for (const demo of series.demos) {
    const tags = tagsByDemo.get(demo.id) ?? [];
    const matched = matchingTags(tags, filter);
    for (const tag of matched) {
      roundCount += 1;
      const rows = utilInTaggedRound(demo.replay, tag, places);
      const chips = usedUtilPlaces(rows, layout);
      for (const row of rows) {
        const chip =
          chips.find((c) => utilMatchesPlace(row, c)) ??
          ({ key: "unknown", label: "?", names: [] } as UtilPlaceChip);
        const key = `${row.kind}|${chip.key}`;
        const prev = counts.get(key);
        if (prev) prev.count += 1;
        else counts.set(key, { chip, kind: row.kind, count: 1 });
      }
    }
  }

  const entries = [...counts.values()].sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
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
        counts.set(beat.title, (counts.get(beat.title) ?? 0) + 1);
      }
    }
  }

  const entries = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { entries, roundCount };
}

export function buildSeriesTags(series: DemoSeries): Map<string, RoundTag[]> {
  return tagSeries(series.demos, series.focalTeam);
}

export function seriesTagsForDemo(
  tagsByDemo: Map<string, RoundTag[]>,
  demoId: string,
): RoundTag[] {
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
