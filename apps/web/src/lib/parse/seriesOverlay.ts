import type { DemoSeries } from "@/lib/parse/session";
import { samplePlayers } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { tickRate } from "@/lib/shared/constants";
import { SERIES_HABITS_WINDOW_SECONDS, SERIES_OVERLAY_MAX_TRAILS } from "@/lib/shared/constants";
import { matchingTags, type SeriesFilter } from "./seriesAnalysis";
import type { RoundTag } from "./roundTags";
import { playerIdentityKey } from "./seriesRoster";
import { steamColor } from "./seriesSteamColor";

export interface HabitsTrail {
  demoId: string;
  roundNumber: number;
  jumpTick: number;
  steamId: number;
  playerName: string;
  color: string;
  points: { x: number; y: number }[];
}

export interface HabitsHeatDot {
  x: number;
  y: number;
  alpha: number;
}

export interface SeriesOverlay {
  trails: HabitsTrail[];
  heatDots: HabitsHeatDot[];
  mode: "trails" | "heatmap";
  roundCount: number;
}

function focalSidePlayersAtFreeze(replay: Replay, tag: RoundTag): number[] {
  const wantCt = tag.sideForFocal === "CT";
  const players = samplePlayers(replay, tag.freezeEndTick);
  return players.filter((p) => p.present && p.ct === wantCt).map((p) => p.index);
}

function sampleForwardTrail(
  replay: Replay,
  player: number,
  fromTick: number,
  untilTick: number,
): { x: number; y: number }[] {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player < 0 || player >= pc) return [];
  const out: { x: number; y: number }[] = [];
  for (let f = 0; f < buf.frameCount; f++) {
    const t = buf.ticks[f];
    if (t < fromTick || t > untilTick) continue;
    const i = f * pc + player;
    if ((buf.flags[i] & FLAG_PRESENT) === 0) continue;
    out.push({ x: buf.x[i], y: buf.y[i] });
  }
  return out;
}

function trailsToHeatmap(trails: HabitsTrail[]): HabitsHeatDot[] {
  const bins = new Map<string, { x: number; y: number; n: number }>();
  const cell = 96;
  for (const trail of trails) {
    for (const pt of trail.points) {
      const bx = Math.round(pt.x / cell);
      const by = Math.round(pt.y / cell);
      const key = `${bx},${by}`;
      const prev = bins.get(key);
      if (prev) prev.n += 1;
      else bins.set(key, { x: bx * cell, y: by * cell, n: 1 });
    }
  }
  let max = 1;
  for (const bin of bins.values()) max = Math.max(max, bin.n);
  return [...bins.values()].map((bin) => ({
    x: bin.x,
    y: bin.y,
    alpha: 0.15 + (0.55 * bin.n) / max,
  }));
}

/** Freeze-relative player paths for one habits filter bucket. */
export function buildSeriesOverlay(
  series: DemoSeries,
  filter: SeriesFilter,
  playerKey: string | null = null,
  windowSeconds = SERIES_HABITS_WINDOW_SECONDS,
): SeriesOverlay {
  const trails: HabitsTrail[] = [];
  let roundCount = 0;

  for (const demo of series.demos) {
    const tags = series.tagsByDemo.get(demo.id) ?? [];
    const matched = matchingTags(tags, filter);
    const tps = tickRate(demo.replay);

    for (const tag of matched) {
      roundCount += 1;
      const until = tag.freezeEndTick + Math.round(tps * windowSeconds);
      for (const player of focalSidePlayersAtFreeze(demo.replay, tag)) {
        const meta = demo.replay.players[player];
        const key = playerIdentityKey(demo.replay, player);
        if (playerKey != null && key !== playerKey) continue;
        const sid = meta?.steam_id ?? 0;
        const points = sampleForwardTrail(demo.replay, player, tag.freezeEndTick, until);
        if (points.length < 2) continue;
        trails.push({
          demoId: demo.id,
          roundNumber: tag.roundNumber,
          jumpTick: tag.freezeEndTick,
          steamId: sid,
          playerName: meta?.name ?? "?",
          color: steamColor(sid),
          points,
        });
      }
    }
  }

  if (trails.length > SERIES_OVERLAY_MAX_TRAILS) {
    return {
      trails: [],
      heatDots: trailsToHeatmap(trails),
      mode: "heatmap",
      roundCount,
    };
  }

  return { trails, heatDots: [], mode: "trails", roundCount };
}

/** Screen-space hit test for jumping into a matched round from the habits overlay. */
export function habitsTrailAtScreen(
  overlay: SeriesOverlay,
  screenX: number,
  screenY: number,
  toScreen: (x: number, y: number) => { x: number; y: number },
  radiusPx = 14,
): HabitsTrail | null {
  if (overlay.mode !== "trails") return null;
  const r2 = radiusPx * radiusPx;
  let best: { trail: HabitsTrail; d2: number } | null = null;
  for (const trail of overlay.trails) {
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
