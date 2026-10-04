import { calloutAtWorld, layoutGroupFilters } from "@/lib/radar/layouts";
import type { MapPlaces } from "@/lib/match/sites";
import { placesReady } from "@/lib/match/sites";
import { matchingTags, type SeriesFilter } from "@/lib/parse/seriesAnalysis";
import type { DemoSeries } from "@/lib/parse/session";
import { playerTeamNameAt } from "@/lib/parse/seriesRoster";
import { branchShare, shareToPercent } from "@/lib/parse/pathBranches";
import type { RoundTag } from "@/lib/parse/roundTags";
import { samplePlayers } from "@/lib/replay/sample";
import { FLAG_ALIVE, FLAG_PRESENT, type Replay } from "@/lib/replay/replayTypes";
import { SERIES_GROUP_HIT_STEP_SECONDS, tickRate } from "@/lib/shared/constants";

export interface SeriesGroupHitEntry {
  id: string;
  label: string;
  /** Alive samples inside this group (one-second steps). */
  samples: number;
  /** `samples / sampleCount` (0–1). Samples outside playable groups are excluded. */
  share: number;
}

export interface SeriesGroupHits {
  /** Layout-filter order (same chips as grenade groups), including zeros. */
  entries: SeriesGroupHitEntry[];
  roundCount: number;
  /** Alive samples that landed in a playable layout group. */
  sampleCount: number;
}

let layoutGroupSampleLookups = 0;

/** Test hook: polygon lookups performed while grouping samples. */
export function layoutGroupSampleLookupsCount(): number {
  return layoutGroupSampleLookups;
}

export function resetLayoutGroupSampleLookups(): void {
  layoutGroupSampleLookups = 0;
}

/** Team spawn rooms. "Outside CT Spawn" is a real area and still counts. */
function isTeamSpawnCallout(name: string): boolean {
  return /^(ct|t)\s+spawn$/i.test(name.trim());
}

/** Groups that contain a non-spawn callout, in layout filter order. */
function playableGroups(places: MapPlaces): { id: string; label: string }[] {
  return layoutGroupFilters(places.layout).filter((group) =>
    places.layout.callouts.some(
      (callout) => callout.group === group.id && !isTeamSpawnCallout(callout.name),
    ),
  );
}

function groupAt(places: MapPlaces, x: number, y: number, z: number): string | null {
  layoutGroupSampleLookups += 1;
  const callout = calloutAtWorld(places.layout, places.cal, x, y, z);
  if (!callout?.group || isTeamSpawnCallout(callout.name)) return null;
  return callout.group;
}

function focalSidePlayers(replay: Replay, tag: RoundTag, focal: ReadonlySet<string>): number[] {
  const wantCt = tag.sideForFocal === "CT";
  const indexes: number[] = [];
  for (const player of samplePlayers(replay, tag.freezeEndTick)) {
    if (!player.present || player.ct !== wantCt) continue;
    const team = playerTeamNameAt(replay, player.index, tag.freezeEndTick);
    if (!team || !focal.has(team)) continue;
    indexes.push(player.index);
  }
  return indexes;
}

export type GroupSampleScan = "linear" | "binary";

/** First frame whose tick is >= `tick`. `length` when every frame is earlier. */
export function firstFrameAtOrAfter(ticks: Uint32Array, tick: number): number {
  let lo = 0;
  let hi = ticks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((ticks[mid] ?? 0) < tick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First frame whose tick is > `tick`. `length` when every frame is at or before it. */
export function firstFrameAfter(ticks: Uint32Array, tick: number): number {
  let lo = 0;
  let hi = ticks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((ticks[mid] ?? 0) <= tick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function addPlayerSamples(
  replay: Replay,
  places: MapPlaces,
  player: number,
  wanted: ReadonlySet<string>,
  freezeEndTick: number,
  endTick: number,
  frameStart: number,
  frameEnd: number,
  stopAtRoundEnd: boolean,
  into: Map<string, number>,
): void {
  const buf = replay.ticks;
  const playerCount = buf.playerCount;
  if (player < 0 || player >= playerCount) return;
  const step = Math.max(1, Math.round(tickRate(replay) * SERIES_GROUP_HIT_STEP_SECONDS));
  let nextTick = freezeEndTick;
  for (let frame = frameStart; frame < frameEnd; frame++) {
    const tick = buf.ticks[frame] ?? 0;
    if (tick < freezeEndTick) continue;
    if (stopAtRoundEnd && tick > endTick) break;
    if (tick < nextTick) continue;
    const slot = frame * playerCount + player;
    const flags = buf.flags[slot] ?? 0;
    if ((flags & FLAG_PRESENT) === 0) {
      nextTick = tick + step;
      continue;
    }
    if ((flags & FLAG_ALIVE) === 0) break;
    nextTick = tick + step;
    const group = groupAt(places, buf.x[slot] ?? 0, buf.y[slot] ?? 0, buf.z[slot] ?? 0);
    if (!group || !wanted.has(group)) continue;
    into.set(group, (into.get(group) ?? 0) + 1);
  }
}

/**
 * Alive samples per layout group from freeze end through round end.
 * `linear` walks from frame 0 (the previous behavior). `binary` uses the sorted tick column.
 */
export function countRoundGroupSamples(
  replay: Replay,
  freezeEndTick: number,
  endTick: number,
  places: MapPlaces,
  players: readonly number[],
  wanted: ReadonlySet<string>,
  scan: GroupSampleScan,
): Map<string, number> {
  const hit = new Map<string, number>();
  if (players.length === 0 || wanted.size === 0) return hit;
  const buf = replay.ticks;
  if (buf.playerCount === 0 || buf.frameCount === 0) return hit;
  const frameStart = scan === "binary" ? firstFrameAtOrAfter(buf.ticks, freezeEndTick) : 0;
  const frameEnd = scan === "binary" ? firstFrameAfter(buf.ticks, endTick) : buf.frameCount;
  if (frameStart >= frameEnd) return hit;
  for (const player of players) {
    addPlayerSamples(
      replay,
      places,
      player,
      wanted,
      freezeEndTick,
      endTick,
      frameStart,
      frameEnd,
      scan === "linear",
      hit,
    );
  }
  return hit;
}

/** Per demo, per round, per player: group → alive samples. Keyed by the loaded demo list. */
interface DemoRoundSamples {
  byRound: Map<number, Map<number, Map<string, number>>>;
}

let groupedDemos: {
  demos: DemoSeries["demos"];
  places: MapPlaces;
  byDemoId: Map<string, DemoRoundSamples>;
} | null = null;

function buildDemoRoundSamples(replay: Replay, places: MapPlaces): DemoRoundSamples {
  const wanted = new Set(playableGroups(places).map((group) => group.id));
  const byRound = new Map<number, Map<number, Map<string, number>>>();
  if (wanted.size === 0) return { byRound };
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const freeze = round.freeze_end_tick || round.start_tick;
    const present = samplePlayers(replay, freeze).filter((player) => player.present);
    const byPlayer = new Map<number, Map<string, number>>();
    for (const player of present) {
      byPlayer.set(
        player.index,
        countRoundGroupSamples(
          replay,
          freeze,
          round.end_tick,
          places,
          [player.index],
          wanted,
          "binary",
        ),
      );
    }
    byRound.set(round.number, byPlayer);
  }
  return { byRound };
}

function samplesForDemos(series: DemoSeries, places: MapPlaces): Map<string, DemoRoundSamples> {
  if (groupedDemos && groupedDemos.demos === series.demos && groupedDemos.places === places) {
    return groupedDemos.byDemoId;
  }
  const byDemoId = new Map<string, DemoRoundSamples>();
  for (const demo of series.demos) {
    byDemoId.set(demo.id, buildDemoRoundSamples(demo.replay, places));
  }
  groupedDemos = { demos: series.demos, places, byDemoId };
  return byDemoId;
}

/** `67%` — same rounding as Aggregated Overall path labels. */
export function formatGroupHitPercent(samples: number, sampleCount: number): string {
  return `${shareToPercent(branchShare(samples, sampleCount))}%`;
}

/**
 * Share of time the focal side spent in each layout filter group.
 * Fine callouts roll up (both Mid rooms count as Mid). Ungrouped rooms and team spawns are ignored.
 */
export function aggregateSeriesGroupHits(
  series: DemoSeries,
  filter: SeriesFilter,
  places: MapPlaces | null,
): SeriesGroupHits {
  const listed = placesReady(places) ? playableGroups(places) : [];
  const listedIds = new Set(listed.map((group) => group.id));
  const counts = new Map<string, number>();
  const focal = new Set(series.focalTeamNames);
  let roundCount = 0;
  let sampleCount = 0;
  const grouped = placesReady(places) ? samplesForDemos(series, places) : null;

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    const byRound = grouped?.get(demo.id)?.byRound;
    for (const tag of matchingTags(tags, filter)) {
      roundCount += 1;
      if (!byRound || listedIds.size === 0) continue;
      const players = focalSidePlayers(demo.replay, tag, focal);
      const byPlayer = byRound.get(tag.roundNumber);
      if (!byPlayer) continue;
      for (const player of players) {
        const samples = byPlayer.get(player);
        if (!samples) continue;
        for (const [group, count] of samples) {
          if (!listedIds.has(group)) continue;
          counts.set(group, (counts.get(group) ?? 0) + count);
          sampleCount += count;
        }
      }
    }
  }

  return {
    entries: listed.map((group) => {
      const samples = counts.get(group.id) ?? 0;
      return {
        id: group.id,
        label: group.label,
        samples,
        share: branchShare(samples, sampleCount),
      };
    }),
    roundCount,
    sampleCount,
  };
}
