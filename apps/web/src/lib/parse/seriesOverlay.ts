import { NADE_COLORS } from "@/lib/radar/radarFx";
import { samplePlayer, samplePlayers } from "@/lib/replay/sample";
import type { DemoSeries } from "@/lib/parse/session";
import type { GrenadeKind, GrenadeThrow, Kill, Replay, Round } from "@/lib/replay/replayTypes";
import { FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { inKnifeRound } from "@/lib/stats/stats";
import { tickRate } from "@/lib/shared/constants";
import {
  SERIES_HABITS_WINDOW_MAX_SECONDS,
  SERIES_HABITS_WINDOW_MIN_SECONDS,
  SERIES_HABITS_WINDOW_SECONDS,
} from "@/lib/shared/constants";
import { SERIES_TRAIL_WINDOW_STORAGE_KEY } from "@/lib/shared/storageKeys";
import { matchingTags, type SeriesFilter } from "./seriesAnalysis";
import type { RoundTag } from "./roundTags";
import { playerIdentityKey } from "./seriesRoster";
import {
  buildPathBranches,
  clampPathBranchOptions,
  type PathBranch,
  type PathBranchOptions,
} from "./pathBranches";
import { steamColor } from "./seriesSteamColor";

export type SeriesOverlayDisplay = "trails" | "overall";

export interface HabitsTrailPoint {
  x: number;
  y: number;
  z: number;
  tick: number;
  yaw: number;
}

export interface HabitsTrail {
  demoId: string;
  roundNumber: number;
  jumpTick: number;
  tps: number;
  steamId: number;
  playerName: string;
  color: string;
  points: HabitsTrailPoint[];
  /** Death location when the player was eliminated before round end. */
  deathAt: { x: number; y: number } | null;
  deathTick: number | null;
  /** Last in-round position when the player survived; no line into the next freeze. */
  survivedAt: { x: number; y: number } | null;
  survivedTick: number | null;
}

export interface HabitsNade {
  kind: GrenadeKind;
  color: string;
  grenade: GrenadeThrow;
  freezeEndTick: number;
  roundEndTick: number;
  tps: number;
  demoId?: string;
  roundNumber?: number;
  steamId?: number;
}

/** Util kinds toggled on the aggregated habits overlay. */
export type HabitsNadeKind = "smoke" | "molotov" | "flash" | "he";

export type HabitsNadeFilter = Record<HabitsNadeKind, boolean>;

export const DEFAULT_HABITS_NADE_FILTER: HabitsNadeFilter = {
  smoke: true,
  molotov: true,
  flash: true,
  he: true,
};

export function habitsNadeVisible(kind: GrenadeKind, filter: HabitsNadeFilter): boolean {
  if (kind === "decoy") return false;
  if (kind === "incendiary") return filter.molotov;
  return filter[kind as HabitsNadeKind] ?? false;
}

export function filterHabitsNades(nades: HabitsNade[], filter: HabitsNadeFilter): HabitsNade[] {
  return nades.filter((nade) => habitsNadeVisible(nade.kind, filter));
}

export interface SeriesOverlay {
  trails: HabitsTrail[];
  /** Aggregated Overall path tree (heatmap replacement). */
  branches: PathBranch[];
  /** Knobs used to build `branches` (playhead clip must reuse these). */
  branchOptions: PathBranchOptions;
  nades: HabitsNade[];
  roundCount: number;
  /** Max freeze-relative seconds across matched rounds (full round length). */
  windowSec: number;
}

/** Seconds from freeze end through round end for one tagged round. */
export function bucketWindowSecForTag(replay: Replay, tag: RoundTag): number {
  const round = replay.rounds.find((r) => r.number === tag.roundNumber);
  if (!round) return SERIES_HABITS_WINDOW_SECONDS;
  const tps = tickRate(replay);
  const freeze = tag.freezeEndTick;
  if (round.end_tick <= freeze) return SERIES_HABITS_WINDOW_MIN_SECONDS;
  return Math.max(SERIES_HABITS_WINDOW_MIN_SECONDS, (round.end_tick - freeze) / tps);
}

/** Longest freeze-relative span among rounds in a habits bucket. */
export function bucketWindowSecForFilter(series: DemoSeries, filter: SeriesFilter): number {
  let max = SERIES_HABITS_WINDOW_MIN_SECONDS;
  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    for (const tag of matchingTags(tags, filter)) {
      max = Math.max(max, bucketWindowSecForTag(demo.replay, tag));
    }
  }
  return max;
}

function playerDeathInRound(
  replay: Replay,
  player: number,
  round: Round,
  fromTick: number,
  untilTick: number,
): Kill | null {
  let best: Kill | null = null;
  for (const k of replay.kills) {
    if (k.victim !== player) continue;
    if (k.tick < fromTick || k.tick > untilTick) continue;
    if (k.tick < round.start_tick || k.tick > round.end_tick) continue;
    if (!best || k.tick < best.tick) best = k;
  }
  return best;
}

export function clampSeriesTrailWindowSec(value: number): number {
  if (!Number.isFinite(value)) return SERIES_HABITS_WINDOW_SECONDS;
  return Math.min(
    SERIES_HABITS_WINDOW_MAX_SECONDS,
    Math.max(SERIES_HABITS_WINDOW_MIN_SECONDS, Math.round(value)),
  );
}

/** One-time localStorage read before IndexedDB settings own this field. */
export function loadHabitsTrailWindowSec(): number {
  try {
    const raw = localStorage.getItem(SERIES_TRAIL_WINDOW_STORAGE_KEY);
    if (raw == null) return SERIES_HABITS_WINDOW_SECONDS;
    return clampSeriesTrailWindowSec(Number(raw));
  } catch {
    return SERIES_HABITS_WINDOW_SECONDS;
  }
}

function focalSidePlayersAtFreeze(replay: Replay, tag: RoundTag): number[] {
  const wantCt = tag.sideForFocal === "CT";
  const players = samplePlayers(replay, tag.freezeEndTick);
  return players.filter((p) => p.present && p.ct === wantCt).map((p) => p.index);
}

function throwerOnFocalSide(replay: Replay, tag: RoundTag, thrower: number): boolean {
  if (thrower < 0) return false;
  const wantCt = tag.sideForFocal === "CT";
  const snap = samplePlayer(replay, thrower, tag.freezeEndTick);
  return Boolean(snap?.present && snap.ct === wantCt);
}

/** Inclusive last tick to sample: this round only, never the next freeze/spawn. */
function trailStopTick(replay: Replay, round: Round, windowUntil: number): number {
  let stop = Math.min(windowUntil, round.end_tick);
  for (const other of replay.rounds) {
    if (other.start_tick <= round.start_tick) continue;
    const lastBeforeNext = other.start_tick - 1;
    if (lastBeforeNext < stop) stop = lastBeforeNext;
  }
  return stop;
}

function sampleForwardTrail(
  replay: Replay,
  player: number,
  fromTick: number,
  untilTick: number,
): HabitsTrailPoint[] {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player < 0 || player >= pc) return [];
  const out: HabitsTrailPoint[] = [];
  for (let f = 0; f < buf.frameCount; f++) {
    const t = buf.ticks[f];
    if (t < fromTick || t > untilTick) continue;
    const i = f * pc + player;
    if ((buf.flags[i] & FLAG_PRESENT) === 0) continue;
    out.push({
      x: buf.x[i],
      y: buf.y[i],
      z: buf.z[i],
      tick: t,
      yaw: buf.yaw[i],
    });
  }
  return out;
}

function overlayFromTrails(
  trails: HabitsTrail[],
  nades: HabitsNade[],
  roundCount: number,
  windowSec: number,
  branchOptions?: Partial<PathBranchOptions>,
): SeriesOverlay {
  const options = clampPathBranchOptions(branchOptions);
  return {
    trails,
    branches: buildPathBranches(trails, options),
    branchOptions: options,
    nades,
    roundCount,
    windowSec,
  };
}

function habitsNadesInTaggedRound(
  replay: Replay,
  tag: RoundTag,
  windowSeconds: number,
  playerKey: string | null,
  demoId: string,
): HabitsNade[] {
  const tps = tickRate(replay);
  const until = tag.freezeEndTick + Math.round(tps * windowSeconds);
  const round = replay.rounds.find((r) => r.number === tag.roundNumber);
  if (!round) return [];

  const out: HabitsNade[] = [];
  for (const g of replay.grenades) {
    if (g.start_tick < tag.freezeEndTick || g.start_tick > until) continue;
    if (g.start_tick < round.start_tick || g.start_tick > round.end_tick) continue;
    if (inKnifeRound(replay, g.start_tick)) continue;
    if (!throwerOnFocalSide(replay, tag, g.thrower)) continue;
    if (playerKey != null && playerIdentityKey(replay, g.thrower) !== playerKey) continue;
    if (g.points.length === 0) continue;
    out.push({
      kind: g.kind,
      color: NADE_COLORS[g.kind] ?? "#fff",
      grenade: g,
      freezeEndTick: tag.freezeEndTick,
      roundEndTick: round.end_tick,
      tps,
      demoId,
      roundNumber: tag.roundNumber,
      steamId: replay.players[g.thrower]?.steam_id ?? 0,
    });
  }
  return out;
}

/** Freeze-relative tick for habits overlay nade rendering at a playhead. */
export function habitsNadeViewTick(nade: HabitsNade, playSec: number): number {
  return nade.freezeEndTick + Math.round(nade.tps * playSec);
}

/** Freeze-relative player paths and util arcs for one habits filter bucket. */
export function buildSeriesOverlay(
  series: DemoSeries,
  filter: SeriesFilter,
  playerKey: string | null = null,
  windowSeconds?: number,
  branchOptions?: Partial<PathBranchOptions>,
): SeriesOverlay {
  const windowSec = windowSeconds ?? bucketWindowSecForFilter(series, filter);
  const trails: HabitsTrail[] = [];
  const nades: HabitsNade[] = [];
  const steamTints = new Map<string, string>();
  let roundCount = 0;

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    const matched = matchingTags(tags, filter);
    const tps = tickRate(demo.replay);

    for (const tag of matched) {
      roundCount += 1;
      const round = demo.replay.rounds.find((r) => r.number === tag.roundNumber);
      if (!round) continue;
      const until = tag.freezeEndTick + Math.round(tps * windowSec);
      nades.push(...habitsNadesInTaggedRound(demo.replay, tag, windowSec, playerKey, demo.id));
      for (const player of focalSidePlayersAtFreeze(demo.replay, tag)) {
        const meta = demo.replay.players[player];
        const key = playerIdentityKey(demo.replay, player);
        if (playerKey != null && key !== playerKey) continue;
        const sid = meta?.steam_id ?? 0;
        const stop = trailStopTick(demo.replay, round, until);
        const death = playerDeathInRound(demo.replay, player, round, tag.freezeEndTick, stop);
        const trailUntil = death ? Math.min(death.tick, stop) : stop;
        const points = sampleForwardTrail(demo.replay, player, tag.freezeEndTick, trailUntil);
        const deathAt = death ? { x: death.x, y: death.y } : null;
        const deathTick = death ? death.tick : null;
        const last = points.at(-1);
        const survivedAt = death || !last ? null : { x: last.x, y: last.y };
        const survivedTick = death || !last ? null : round.end_tick;
        if (points.length < 2 && !deathAt) continue;
        trails.push({
          demoId: demo.id,
          roundNumber: tag.roundNumber,
          jumpTick: tag.freezeEndTick,
          tps,
          steamId: sid,
          playerName: meta?.name ?? "?",
          color: steamColor(sid, steamTints),
          points,
          deathAt,
          deathTick,
          survivedAt,
          survivedTick,
        });
      }
    }
  }

  return overlayFromTrails(trails, nades, roundCount, windowSec, branchOptions);
}

function clipTrailsForPlaySec(trails: HabitsTrail[], playSec: number): HabitsTrail[] {
  const out: HabitsTrail[] = [];
  for (const trail of trails) {
    const until = trail.jumpTick + Math.round(trail.tps * playSec);
    const points = trail.points.filter((p) => p.tick <= until);
    const showDeath = trail.deathAt != null && trail.deathTick != null && trail.deathTick <= until;
    const showSurvived =
      !showDeath &&
      trail.survivedAt != null &&
      trail.survivedTick != null &&
      trail.survivedTick <= until;
    if (points.length < 2 && !showDeath) continue;
    out.push({
      ...trail,
      points,
      deathAt: showDeath ? trail.deathAt : null,
      deathTick: showDeath ? trail.deathTick : null,
      survivedAt: showSurvived ? trail.survivedAt : null,
      survivedTick: showSurvived ? trail.survivedTick : null,
    });
  }
  return out;
}

function clipNadesForPlaySec(nades: HabitsNade[], playSec: number): HabitsNade[] {
  return nades.filter((nade) => {
    const until = nade.freezeEndTick + Math.round(nade.tps * playSec);
    return nade.grenade.start_tick <= until;
  });
}

/** Visible slice of a full-window overlay at a freeze-relative playhead. */
export function overlayAtPlaySec(overlay: SeriesOverlay, playSec: number): SeriesOverlay {
  const trails = clipTrailsForPlaySec(overlay.trails, playSec);
  return overlayFromTrails(
    trails,
    clipNadesForPlaySec(overlay.nades, playSec),
    overlay.roundCount,
    overlay.windowSec,
    overlay.branchOptions,
  );
}

/** Screen-space hit test for jumping into a matched round from the habits overlay. */
export function habitsTrailAtScreen(
  overlay: SeriesOverlay,
  display: SeriesOverlayDisplay,
  screenX: number,
  screenY: number,
  toScreen: (x: number, y: number) => { x: number; y: number },
  radiusPx = 14,
  playSec?: number,
): HabitsTrail | null {
  if (display !== "trails") return null;
  const visible = playSec != null ? overlayAtPlaySec(overlay, playSec) : overlay;
  const r2 = radiusPx * radiusPx;
  let best: { trail: HabitsTrail; d2: number } | null = null;
  for (const trail of visible.trails) {
    for (const pt of trail.points) {
      const s = toScreen(pt.x, pt.y);
      const dx = s.x - screenX;
      const dy = s.y - screenY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && (!best || d2 < best.d2)) best = { trail, d2 };
    }
  }
  return best?.trail ?? null;
}

/** Tick to land on when jumping from a habits arrow (head of the visible path). */
export function habitsArrowJumpTick(trail: HabitsTrail): number {
  return trail.points.at(-1)?.tick ?? trail.jumpTick;
}

/** Head-of-path hit test for habits player arrows (double-click to jump). */
export function habitsArrowAtScreen(
  overlay: SeriesOverlay,
  showArrows: boolean,
  screenX: number,
  screenY: number,
  toScreen: (x: number, y: number) => { x: number; y: number },
  radiusPx = 16,
  playSec?: number,
): HabitsTrail | null {
  if (!showArrows) return null;
  const visible = playSec != null ? overlayAtPlaySec(overlay, playSec) : overlay;
  const r2 = radiusPx * radiusPx;
  let best: { trail: HabitsTrail; d2: number } | null = null;
  for (const trail of visible.trails) {
    const head = trail.points.at(-1);
    if (!head) continue;
    const s = toScreen(head.x, head.y);
    const dx = s.x - screenX;
    const dy = s.y - screenY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && (!best || d2 < best.d2)) best = { trail, d2 };
  }
  return best?.trail ?? null;
}
