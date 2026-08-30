import { NADE_LABEL } from "@/lib/match/roundEvents";
import { calloutsForUtilRow, matchingTags, type SeriesFilter } from "@/lib/parse/seriesAnalysis";
import { utilityThrough, type UtilThrowRow } from "@/lib/match/utility";
import type { MapPlaces } from "@/lib/match/sites";
import type { DemoSeries } from "@/lib/parse/session";
import { samplePlayer } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { tickRate } from "@/lib/shared/constants";
import { SERIES_FIRST_WAVE_SECONDS } from "@/lib/shared/constants";
import type { RoundTag } from "./roundTags";

export interface UtilSetEntry {
  key: string;
  label: string;
  count: number;
}

function focalThrower(replay: Replay, tag: RoundTag, thrower: number): boolean {
  const wantCt = tag.sideForFocal === "CT";
  const snap = samplePlayer(replay, thrower, tag.freezeEndTick);
  return Boolean(snap?.present && snap.ct === wantCt);
}

function firstWaveThrows(
  replay: Replay,
  tag: RoundTag,
  places: MapPlaces | null,
  windowSeconds: number,
): UtilThrowRow[] {
  const tps = tickRate(replay);
  const until = tag.freezeEndTick + Math.round(tps * windowSeconds);
  const summary = utilityThrough(replay, until, null, places);
  return summary.throws.filter(
    (row) =>
      row.round === tag.roundNumber &&
      row.tick >= tag.freezeEndTick &&
      row.tick <= until &&
      row.thrower >= 0 &&
      focalThrower(replay, tag, row.thrower),
  );
}

function utilSetKey(rows: UtilThrowRow[]): string {
  const parts: string[] = [];
  for (const row of [...rows].sort((a, b) => a.tick - b.tick || a.kind.localeCompare(b.kind))) {
    const callout = calloutsForUtilRow(row).join("+");
    parts.push(`${row.kind}:${callout}`);
  }
  return parts.join("|");
}

function utilSetLabel(rows: UtilThrowRow[]): string {
  if (rows.length === 0) return "—";
  const parts: string[] = [];
  for (const row of [...rows].sort((a, b) => a.tick - b.tick || a.kind.localeCompare(b.kind))) {
    const callout = calloutsForUtilRow(row).join(", ");
    parts.push(`${NADE_LABEL[row.kind]} ${callout}`);
  }
  return parts.join(" + ");
}

/** Count repeated first-wave util multisets across filter-matched rounds. */
export function aggregateUtilSets(
  series: DemoSeries,
  filter: SeriesFilter,
  places: MapPlaces | null,
  windowSeconds = SERIES_FIRST_WAVE_SECONDS,
): { entries: UtilSetEntry[]; roundCount: number } {
  const counts = new Map<string, { label: string; count: number }>();
  let roundCount = 0;

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    for (const tag of matchingTags(tags, filter)) {
      roundCount += 1;
      const rows = firstWaveThrows(demo.replay, tag, places, windowSeconds);
      const key = utilSetKey(rows);
      const label = utilSetLabel(rows);
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }

  const entries = [...counts.values()]
    .map(({ label, count }) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { entries, roundCount };
}
