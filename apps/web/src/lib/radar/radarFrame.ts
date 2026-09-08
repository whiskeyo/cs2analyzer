/**
 * What the radar should show at one tick, decided without a canvas.
 *
 * Positions are world coordinates; the painter projects them. Radii and line
 * widths are already in screen pixels because they depend on the zoom, not on
 * the map scale. Everything here is pure, so radar behaviour is testable in
 * node without mocking a 2D context.
 *
 * Drawings, text notes and the radar image stay in the component: they need
 * `measureText`, loaded images, and the text editor's DOM box.
 */

import { FLASH_FULL_SECONDS, tickRate } from "@/lib/shared/constants";
import { radarFloor, worldOnRadar } from "@/lib/radar/maps";
import { grenadePosAt } from "@/lib/radar/draw";
import {
  blindsAt,
  firesAt,
  HIT_SECONDS,
  hitsAt,
  killLineEnds,
  lingerRemaining,
  NADE_COLORS,
  nadeBurstSpan,
  nadeLandPos,
  nadePopTick,
  nadeVisibleEnd,
  nadesForSummary,
  openingDuel,
  TRACER_SECONDS,
} from "@/lib/radar/radarFx";
import { inTickWindow, upToTick } from "@/lib/replay/eventIndex";
import { currentRound, samplePlayers, sampleTrail, type SampledPlayer } from "@/lib/replay/sample";
import { bombView, type BombView } from "@/lib/stats/hud";
import type {
  GrenadeThrow,
  Kill,
  MapCalibration,
  GrenadeKind,
  Replay,
  Round,
} from "@/lib/replay/replayTypes";
import { isFireGrenade } from "@/lib/replay/replayTypes";
import type { FloorMode, MapLayers, SummaryFilter } from "@/lib/notes/types";

/** Side colours and marker sizes. Pixels, so they are visual constants. */
export const CT_COLOR = "#5b9fd6";
export const T_COLOR = "#c9a227";
const HEADSHOT_HEAT = "#ff8a8a";
const ATTACKER_HEAT = "#ee6c4d";
const VICTIM_HEAT = "#5b9fd6";
const DEATH_MARK_COLOR = "#e04b4b";
const SURVIVE_MARK_COLOR = "#3dba6a";
const OPENING_T_COLOR = "#ffd24a";
const TRACER_COLOR = "#ffe9a8";

/** Nade zoom is capped so a deep zoom does not turn a smoke into a wall. */
const MAX_NADE_ZOOM = 1.4;
const MAX_CONE_ZOOM = 1.6;
const SUMMARY_RADIUS: Record<GrenadeKind, number> = {
  smoke: 16,
  molotov: 12,
  incendiary: 12,
  he: 10,
  flash: 8,
  decoy: 8,
};
/** Landed nade cloud / burst size on the radar (screen px at zoom 1). */
export const NADE_LINGER_RADIUS: Record<GrenadeKind, number> = {
  smoke: 32,
  molotov: 24,
  incendiary: 24,
  he: 18,
  flash: 12,
  decoy: 12,
};
const FIRE_CELL_RADIUS = 8;
const TRAIL_SECONDS = 2.5;
const VIEW_CONE_RADIUS = 78;

export interface Point {
  x: number;
  y: number;
}

export interface HeatDot extends Point {
  radius: number;
  color: string;
}

export interface SummaryDisc extends Point {
  radius: number;
  color: string;
}

export interface Tracer extends Point {
  /** Raw `m_angEyeAngles` yaw; the painter converts it to canvas radians. */
  yaw: number;
  /** 1 at the shot, 0 when the tracer expires. */
  fade: number;
}

export interface KillLine {
  from: Point;
  to: Point;
  color: string;
  alpha: number;
  lineWidth: number;
}

export interface DeathMark extends Point {
  line: KillLine | null;
}

export interface OpeningDuel {
  from: Point;
  to: Point;
  color: string;
}

export interface Trail {
  points: Point[];
  color: string;
}

export interface ViewCone extends Point {
  yaw: number;
  radius: number;
  color: string;
}

export interface HitPulse extends Point {
  innerRadius: number;
  ringRadius: number;
  innerAlpha: number;
  ringAlpha: number;
}

export interface FlashPulse extends Point {
  /** 0..1 brightness of the flash still on the player. */
  intensity: number;
  pulseRadius: number;
  /** 1 at a full-face flash, 0 when the blind expires. */
  left: number;
}

export interface Pawn extends Point {
  index: number;
  yaw: number;
  color: string;
  alive: boolean;
  selected: boolean;
  /** Seconds of flash left, 0 when unblinded. */
  flash: number;
  name: string;
  health: number;
  /** True when this pawn holds the pack (`GEAR_C4`). */
  carriesC4?: boolean;
  planting?: boolean;
  defusing?: boolean;
}

/** A grenade in exactly one of its render phases, or absent from the frame. */
export type NadeRender =
  | {
      phase: "flight";
      kind: GrenadeKind;
      color: string;
      trail: Point[];
      head: Point | null;
    }
  | {
      phase: "fires";
      kind: GrenadeKind;
      color: string;
      cells: Point[];
      cellRadius: number;
      centroid: Point;
      dialRadius: number;
      /** 1 at the pop, 0 at burn-out. */
      left: number;
      trail: Point[];
    }
  | {
      phase: "linger";
      kind: GrenadeKind;
      color: string;
      at: Point;
      radius: number;
      dialRadius: number;
      left: number;
      trail: Point[];
    }
  | {
      phase: "burst";
      kind: GrenadeKind;
      color: string;
      at: Point;
      /** 0..1 through the HE burst animation. */
      progress: number;
      trail: Point[];
    }
  | {
      phase: "puff";
      kind: GrenadeKind;
      color: string;
      at: Point;
      radius: number;
      alpha: number;
      trail: Point[];
    };

export interface RadarFrame {
  tick: number;
  round: Round | null;
  players: SampledPlayer[];
  useLowerFloor: boolean;
  heatmap: HeatDot[];
  summary: SummaryDisc[];
  nades: NadeRender[];
  tracers: Tracer[];
  bomb: BombView;
  deaths: DeathMark[];
  opening: OpeningDuel | null;
  trails: Trail[];
  cone: ViewCone | null;
  hits: HitPulse[];
  flashes: FlashPulse[];
  pawns: Pawn[];
}

export interface FrameInput {
  replay: Replay;
  tick: number;
  layers: MapLayers;
  summaryFilter: SummaryFilter;
  selected: number | null;
  trails: boolean;
  floorMode: FloorMode;
  cal: MapCalibration | undefined;
  /** Current pan-zoom scale; 1 is the fitted view. */
  scale: number;
  /** Hide live playback layers; habits overlay paints on a blank map. */
  habitsOnly?: boolean;
}

function sideColor(ct: boolean): string {
  return ct ? CT_COLOR : T_COLOR;
}

const eventTick = (e: { tick: number }) => e.tick;
const killTick = (k: Kill) => k.tick;
/** Throws are indexed by when they left the hand, which is what picks the round. */
const throwTick = (g: GrenadeThrow) => g.start_tick;

function throwTrail(g: GrenadeThrow): Point[] {
  return g.points.map((p) => ({ x: p.x, y: p.y }));
}

function heatDots(replay: Replay, tick: number, focus: number | null): HeatDot[] {
  const out: HeatDot[] = [];
  for (const k of upToTick(replay.kills, killTick, tick)) {
    if (focus != null && k.attacker !== focus && k.victim !== focus) continue;
    const byFocus = k.attacker === focus;
    out.push({
      x: k.x,
      y: k.y,
      radius: byFocus ? 7 : 5,
      color:
        focus == null
          ? k.headshot
            ? HEADSHOT_HEAT
            : T_COLOR
          : byFocus
            ? ATTACKER_HEAT
            : VICTIM_HEAT,
    });
  }
  return out;
}

function summaryDiscs(replay: Replay, filter: SummaryFilter, zoom: number): SummaryDisc[] {
  const out: SummaryDisc[] = [];
  for (const g of nadesForSummary(replay, filter)) {
    const land = nadeLandPos(g);
    if (!land) continue;
    out.push({
      x: land.x,
      y: land.y,
      radius: SUMMARY_RADIUS[g.kind] * zoom,
      color: NADE_COLORS[g.kind] ?? "#fff",
    });
  }
  return out;
}

/**
 * The grenade state machine: in flight, lingering (smoke / molly / decoy),
 * bursting (HE / flash), or a plain puff. Throws from other rounds are skipped,
 * and a molly whose occupancy died early stops drawing instead of leaving an
 * envelope circle behind.
 */
export function nadeRenderAt(
  g: GrenadeThrow,
  tick: number,
  tps: number,
  zoom: number,
  roundEnd?: number,
): NadeRender | null {
  const color = NADE_COLORS[g.kind] ?? "#fff";
  const popAt = nadePopTick(g);
  const visibleEnd = nadeVisibleEnd(g, tps, roundEnd);
  const inFlight = tick >= g.start_tick && tick < popAt && tick <= visibleEnd;
  const lingering =
    tick >= popAt &&
    tick <= visibleEnd &&
    (g.kind === "smoke" || isFireGrenade(g.kind) || g.kind === "decoy");
  const burstSpan = nadeBurstSpan(g.kind, tps);
  const burst = burstSpan > 0 && tick >= popAt && tick <= popAt + burstSpan && tick <= visibleEnd;

  if (inFlight) {
    const trail: Point[] = [];
    for (const p of g.points) {
      if (p.tick > tick) break;
      trail.push({ x: p.x, y: p.y });
    }
    const head = grenadePosAt(g.points, tick);
    return {
      phase: "flight",
      kind: g.kind,
      color,
      trail,
      head: head ? { x: head.x, y: head.y } : null,
    };
  }
  if (!lingering && !burst) return null;

  const cells = isFireGrenade(g.kind) ? firesAt(g.fires, tick) : [];
  if (lingering && cells.length > 0) {
    const centroid = { x: 0, y: 0 };
    for (const cell of cells) {
      centroid.x += cell.x;
      centroid.y += cell.y;
    }
    centroid.x /= cells.length;
    centroid.y /= cells.length;
    return {
      phase: "fires",
      kind: g.kind,
      color,
      cells: cells.map((cell) => ({ x: cell.x, y: cell.y })),
      cellRadius: FIRE_CELL_RADIUS * zoom,
      centroid,
      dialRadius: Math.max(5, 6 * zoom),
      left: lingerRemaining(popAt, visibleEnd, tick),
      trail: throwTrail(g),
    };
  }
  if (lingering && isFireGrenade(g.kind) && (g.fires?.length ?? 0) > 0) return null;

  const last = g.points[g.points.length - 1];
  if (!last) return null;
  const at = { x: last.x, y: last.y };
  const radius = NADE_LINGER_RADIUS[g.kind] * zoom;
  const trail = throwTrail(g);
  if (lingering && (g.kind === "smoke" || isFireGrenade(g.kind))) {
    return {
      phase: "linger",
      kind: g.kind,
      color,
      at,
      radius,
      dialRadius: Math.max(7, 8 * zoom),
      left: lingerRemaining(popAt, visibleEnd, tick),
      trail,
    };
  }
  if (burst && g.kind === "he") {
    return {
      phase: "burst",
      kind: g.kind,
      color,
      at,
      progress: (tick - popAt) / (nadeBurstSpan("he", tps) || 1),
      trail,
    };
  }
  return { phase: "puff", kind: g.kind, color, at, radius, alpha: burst ? 0.45 : 0.28, trail };
}

export function nadeRenders(
  replay: Replay,
  tick: number,
  round: Round | null,
  zoom: number,
): NadeRender[] {
  const tps = tickRate(replay);
  const out: NadeRender[] = [];
  const throws = round
    ? inTickWindow(replay.grenades, throwTick, round.start_tick, round.end_tick)
    : replay.grenades;
  for (const g of throws) {
    const render = nadeRenderAt(g, tick, tps, zoom, round?.end_tick);
    if (render) out.push(render);
  }
  return out;
}

function tracers(replay: Replay, tick: number, tps: number): Tracer[] {
  const life = tps * TRACER_SECONDS;
  const out: Tracer[] = [];
  for (const shot of inTickWindow(replay.shots, eventTick, tick - life, tick)) {
    out.push({ x: shot.x, y: shot.y, yaw: shot.yaw, fade: 1 - (tick - shot.tick) / life });
  }
  return out;
}

function deathMarks(replay: Replay, tick: number, round: Round | null): DeathMark[] {
  if (!round) return [];
  const out: DeathMark[] = [];
  const window = inTickWindow(
    replay.kills,
    killTick,
    round.freeze_end_tick,
    Math.min(tick, round.end_tick),
  );
  for (const k of window) {
    const ends = killLineEnds(replay, k);
    out.push({
      x: k.x,
      y: k.y,
      line: ends
        ? {
            from: ends.from,
            to: ends.to,
            color: sideColor(ends.ct),
            alpha: k.headshot ? 0.9 : 0.7,
            lineWidth: k.headshot ? 2 : 1.6,
          }
        : null,
    });
  }
  return out;
}

function openingArrow(replay: Replay, tick: number, round: Round | null): OpeningDuel | null {
  if (!round) return null;
  const duel = openingDuel(replay, round, tick);
  if (!duel) return null;
  const ends = killLineEnds(replay, duel);
  if (!ends) return null;
  return {
    from: ends.from,
    to: ends.to,
    color: ends.ct ? CT_COLOR : OPENING_T_COLOR,
  };
}

function playerTrails(
  replay: Replay,
  tick: number,
  players: SampledPlayer[],
  selected: number | null,
  tps: number,
  cal: MapCalibration | undefined,
): Trail[] {
  const lookback = tps * TRAIL_SECONDS;
  const ids = selected != null ? [selected] : players.map((p) => p.index);
  const out: Trail[] = [];
  for (const id of ids) {
    const points = sampleTrail(replay, id, tick, lookback).filter((pt) =>
      worldOnRadar(cal, pt.x, pt.y),
    );
    if (points.length < 2) continue;
    out.push({ points, color: sideColor(players.find((p) => p.index === id)?.ct ?? false) });
  }
  return out;
}

function viewCone(
  players: SampledPlayer[],
  selected: number | null,
  zoom: number,
): ViewCone | null {
  if (selected == null) return null;
  const p = players.find((x) => x.index === selected && x.present && x.alive);
  if (!p) return null;
  return {
    x: p.x,
    y: p.y,
    yaw: p.yaw,
    radius: VIEW_CONE_RADIUS * zoom,
    color: p.ct ? "rgba(91,159,214,0.18)" : "rgba(201,162,39,0.18)",
  };
}

export function buildRadarFrame(input: FrameInput): RadarFrame {
  const { replay, tick, layers, selected, cal, scale } = input;
  if (input.habitsOnly) {
    return {
      tick,
      round: null,
      players: [],
      useLowerFloor: false,
      heatmap: [],
      summary: [],
      nades: [],
      tracers: [],
      bomb: { state: "none" },
      deaths: [],
      opening: null,
      trails: [],
      cone: null,
      hits: [],
      flashes: [],
      pawns: [],
    };
  }
  const tps = tickRate(replay);
  const round = currentRound(replay, tick);
  const players = samplePlayers(replay, tick);
  const nadeZoom = Math.min(MAX_NADE_ZOOM, scale);
  const blinds = blindsAt(replay.blinds, tick, tps);
  const hits = hitsAt(replay.hurts, tick, tps);
  const bomb = bombView(replay, tick);

  const hitPulses: HitPulse[] = [];
  const flashPulses: FlashPulse[] = [];
  const pawns: Pawn[] = [];
  for (const p of players) {
    if (!p.present) continue;
    if (!worldOnRadar(cal, p.x, p.y)) continue;
    const hit = hits.get(p.index);
    if (hit) {
      const age = Math.min(1, hit.age / HIT_SECONDS);
      hitPulses.push({
        x: p.x,
        y: p.y,
        innerRadius: 7 + (1 - age) * 5,
        ringRadius: 9 + age * 14 + Math.min(hit.damage, 100) * 0.04,
        innerAlpha: (1 - age) * 0.3,
        ringAlpha: (1 - age) * 0.9,
      });
    }
    const flash = blinds.get(p.index) ?? 0;
    if (flash > 0 && p.alive) {
      const intensity = Math.min(1, flash / 1.4);
      flashPulses.push({
        x: p.x,
        y: p.y,
        intensity,
        pulseRadius: 13 + intensity * 6 + Math.sin((tick / tps) * 10) * 1.4,
        left: Math.min(1, flash / FLASH_FULL_SECONDS),
      });
    }
    pawns.push({
      index: p.index,
      x: p.x,
      y: p.y,
      yaw: p.yaw,
      color: sideColor(p.ct),
      alive: p.alive,
      selected: selected === p.index,
      flash,
      name: replay.players[p.index]?.name ?? "",
      health: p.health,
      carriesC4: bomb.state === "carried" && bomb.player === p.index,
      planting: p.planting,
      defusing: p.defusing,
    });
  }

  return {
    tick,
    round,
    players,
    useLowerFloor: radarFloor(cal, players, selected, input.floorMode) === "lower",
    heatmap: layers.heatmap ? heatDots(replay, tick, selected) : [],
    summary: layers.summary ? summaryDiscs(replay, input.summaryFilter, nadeZoom) : [],
    nades: layers.grenades ? nadeRenders(replay, tick, round, nadeZoom) : [],
    tracers: layers.shots ? tracers(replay, tick, tps) : [],
    bomb,
    deaths: layers.deaths ? deathMarks(replay, tick, round) : [],
    opening: layers.openings ? openingArrow(replay, tick, round) : null,
    trails: input.trails ? playerTrails(replay, tick, players, selected, tps, cal) : [],
    cone: layers.cone ? viewCone(players, selected, Math.min(MAX_CONE_ZOOM, scale)) : null,
    hits: hitPulses,
    flashes: flashPulses,
    pawns,
  };
}

export const RADAR_STYLE = {
  heatmapAlpha: 0.22,
  deathMarkColor: DEATH_MARK_COLOR,
  surviveMarkColor: SURVIVE_MARK_COLOR,
  tracerColor: TRACER_COLOR,
} as const;
