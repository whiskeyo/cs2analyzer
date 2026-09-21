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

/** Alive samples per layout group between freeze end and round end. */
function groupSamplesInRound(
  replay: Replay,
  tag: RoundTag,
  places: MapPlaces,
  players: number[],
  wanted: ReadonlySet<string>,
): Map<string, number> {
  const hit = new Map<string, number>();
  if (players.length === 0 || wanted.size === 0) return hit;

  const round = replay.rounds.find((candidate) => candidate.number === tag.roundNumber);
  if (!round) return hit;

  const buf = replay.ticks;
  const playerCount = buf.playerCount;
  if (playerCount === 0 || buf.frameCount === 0) return hit;

  const step = Math.max(1, Math.round(tickRate(replay) * SERIES_GROUP_HIT_STEP_SECONDS));
  const end = round.end_tick;

  for (const player of players) {
    if (player < 0 || player >= playerCount) continue;
    let nextTick = tag.freezeEndTick;
    for (let frame = 0; frame < buf.frameCount; frame++) {
      const tick = buf.ticks[frame];
      if (tick < tag.freezeEndTick) continue;
      if (tick > end) break;
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
      hit.set(group, (hit.get(group) ?? 0) + 1);
    }
  }
  return hit;
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
  const wanted = new Set(listed.map((group) => group.id));
  const counts = new Map<string, number>();
  const focal = new Set(series.focalTeamNames);
  let roundCount = 0;
  let sampleCount = 0;

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    for (const tag of matchingTags(tags, filter)) {
      roundCount += 1;
      if (!placesReady(places) || wanted.size === 0) continue;
      const players = focalSidePlayers(demo.replay, tag, focal);
      for (const [group, samples] of groupSamplesInRound(
        demo.replay,
        tag,
        places,
        players,
        wanted,
      )) {
        counts.set(group, (counts.get(group) ?? 0) + samples);
        sampleCount += samples;
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
