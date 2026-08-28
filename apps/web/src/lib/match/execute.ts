import {
  NADE_SITE_SEPARATION,
  PULSE_SITE_SEPARATION,
  T_PUSH_DELAY_SECONDS,
  T_PUSH_MAX_SPREAD,
  T_PUSH_MIN_MOVED,
  T_PUSH_MIN_PLAYERS,
  T_PUSH_STEP_SECONDS,
  tickRate,
} from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import {
  placeAt,
  placeFromLandings,
  placeLabel,
  plantPlace,
  placeMatchesLayoutGroup,
  siteAt,
  type MapPlaces,
  type PlaceHit,
  type SiteCallout,
} from "./sites";
import { currentSide, isEnemyKill, plantedBombPos } from "@/lib/stats/stats";
import type { GrenadeThrow, Kill, Replay, Round, Side } from "@/lib/replay/replayTypes";
import { formatClock } from "@/lib/weapons/weapons";
import type { MapLayout } from "@/lib/radar/layouts";

export type { SiteCallout } from "./sites";
export type ExecuteKind = "execute" | "retake" | "plant" | "fight";

export interface ExecuteBeat {
  tick: number;
  actionTick: number;
  round: number;
  roundLabel: string;
  kind: ExecuteKind;
  side: Side | null;
  site: SiteCallout | null;
  location: string | null;
  title: string;
  detail: string;
}

const UTIL = new Set(["smoke", "molotov", "flash", "he"]);

function tps(replay: Replay): number {
  return tickRate(replay);
}

function inRound(r: Round, tick: number): boolean {
  return tick >= r.start_tick && tick <= r.end_tick;
}

function clusterByTick<T>(items: T[], tickOf: (x: T) => number, gap: number): T[][] {
  if (items.length === 0) return [];
  const sorted = items.slice().sort((a, b) => tickOf(a) - tickOf(b));
  const groups: T[][] = [];
  let cur: T[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (tickOf(sorted[i]) - tickOf(sorted[i - 1]) <= gap) cur.push(sorted[i]);
    else {
      groups.push(cur);
      cur = [sorted[i]];
    }
  }
  groups.push(cur);
  return groups;
}

function landing(g: GrenadeThrow): { x: number; y: number; z: number } | null {
  if (g.points.length === 0) return null;
  const hit = g.points.find((p) => p.tick === g.detonate_tick) ?? g.points[g.points.length - 1];
  return { x: hit.x, y: hit.y, z: hit.z };
}

function centroid(pts: { x: number; y: number }[]): { x: number; y: number } | null {
  if (pts.length === 0) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function nadeCentroid(nades: GrenadeThrow[]): { x: number; y: number; z: number } | null {
  const pts = nades.map(landing).filter((p): p is { x: number; y: number; z: number } => p != null);
  const xy = centroid(pts);
  if (!xy) return null;
  return { ...xy, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
}

/** Split a timed dump if nades landed on opposite sides of the map. */
function spatialClusters(nades: GrenadeThrow[], maxDist: number): GrenadeThrow[][] {
  const xy = nades.map(landing);
  if (xy.some((p) => p == null) || xy.filter(Boolean).length < 2) return [nades];
  const parent = nades.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < nades.length; i++) {
    for (let j = i + 1; j < nades.length; j++) {
      const a = xy[i]!;
      const b = xy[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= maxDist) {
        const pa = find(i);
        const pb = find(j);
        if (pa !== pb) parent[pa] = pb;
      }
    }
  }
  const groups = new Map<number, GrenadeThrow[]>();
  for (let i = 0; i < nades.length; i++) {
    const r = find(i);
    const g = groups.get(r) ?? [];
    g.push(nades[i]);
    groups.set(r, g);
  }
  return [...groups.values()];
}

function clusterUtil(nades: GrenadeThrow[], gap: number): GrenadeThrow[][] {
  const out: GrenadeThrow[][] = [];
  for (const timed of clusterByTick(nades, (g) => g.detonate_tick, gap)) {
    out.push(...spatialClusters(timed, NADE_SITE_SEPARATION));
  }
  return out;
}

function utilScore(nades: GrenadeThrow[]): { smokes: number; mollys: number; total: number } {
  let smokes = 0;
  let mollys = 0;
  for (const g of nades) {
    if (g.kind === "smoke") smokes += 1;
    if (g.kind === "molotov") mollys += 1;
  }
  return { smokes, mollys, total: nades.length };
}

function isDump(nades: GrenadeThrow[]): boolean {
  const s = utilScore(nades);
  return s.smokes >= 2 || (s.smokes >= 1 && s.mollys >= 1) || s.total >= 4;
}

function sideStats(replay: Replay, tick: number, ct: boolean) {
  const pts = samplePlayers(replay, tick).filter((p) => p.present && p.alive && p.ct === ct);
  if (pts.length < T_PUSH_MIN_PLAYERS) return null;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const spread = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length;
  return { n: pts.length, cx, cy, spread };
}

/** First tick a grouped T pack is actually on A or B — not just walking out of spawn. */
function tPushTick(
  replay: Replay,
  round: Round,
  places: MapPlaces | null | undefined,
): { tick: number; x: number; y: number } | null {
  const rate = tps(replay);
  const freeze = round.freeze_end_tick || round.start_tick;
  const start = sideStats(replay, freeze, false);
  if (!start) return null;
  const from = freeze + rate * T_PUSH_DELAY_SECONDS;
  const step = rate * T_PUSH_STEP_SECONDS;
  for (let tick = from; tick < round.end_tick; tick += step) {
    const now = sideStats(replay, tick, false);
    if (!now) continue;
    const moved = Math.hypot(now.cx - start.cx, now.cy - start.cy);
    if (
      now.n < T_PUSH_MIN_PLAYERS ||
      now.spread >= T_PUSH_MAX_SPREAD ||
      moved <= T_PUSH_MIN_MOVED
    ) {
      continue;
    }
    const site = siteAt(places, now.cx, now.cy);
    if (site === "A" || site === "B") {
      return { tick, x: now.cx, y: now.cy };
    }
  }
  return null;
}

function roundClock(replay: Replay, round: Round, tick: number): string {
  const rate = tps(replay);
  const start = round.freeze_end_tick || round.start_tick;
  return formatClock(Math.max(0, (tick - start) / rate));
}

interface Pulse {
  tick: number;
  tag: "t-util" | "ct-util" | "t-push" | "plant" | "kills";
  nades?: GrenadeThrow[];
  kills?: Kill[];
  x?: number;
  y?: number;
  z?: number;
}

function pulseXY(p: Pulse): { x: number; y: number } | null {
  return p.x != null && p.y != null ? { x: p.x, y: p.y } : null;
}

function tooFar(window: Pulse[], next: Pulse): boolean {
  const b = pulseXY(next);
  if (!b) return false;
  const pts = window.map(pulseXY).filter((p): p is { x: number; y: number } => p != null);
  if (pts.length === 0) return false;
  return pts.every((a) => Math.hypot(a.x - b.x, a.y - b.y) > PULSE_SITE_SEPARATION);
}

function withXY(p: Pulse, xy: { x: number; y: number; z?: number } | null): Pulse {
  return xy ? { ...p, x: xy.x, y: xy.y, z: xy.z } : p;
}

function windowPoint(win: Pulse[]): { x: number; y: number; z?: number } | null {
  const plant = win.find((w) => w.tag === "plant" && w.x != null && w.y != null);
  if (plant && plant.x != null && plant.y != null) {
    return { x: plant.x, y: plant.y, z: plant.z };
  }
  const pts = win.filter((w) => w.x != null && w.y != null);
  if (pts.length === 0) return null;
  const zs = pts.flatMap((w) => (w.z != null ? [w.z] : []));
  return {
    x: pts.reduce((s, w) => s + w.x!, 0) / pts.length,
    y: pts.reduce((s, w) => s + w.y!, 0) / pts.length,
    z: zs.length > 0 ? zs.reduce((s, z) => s + z, 0) / zs.length : undefined,
  };
}

function roundLabel(r: Round): string {
  return r.is_knife ? "Knife" : `R${r.number}`;
}

function leadIn(replay: Replay, round: Round, action: number): number {
  const rate = tps(replay);
  const floor = round.freeze_end_tick || round.start_tick;
  return Math.max(floor, action - Math.round(2 * rate));
}

function nadeBits(nades: GrenadeThrow[]): string {
  if (nades.length === 0) return "";
  const s = utilScore(nades);
  const parts: string[] = [];
  if (s.smokes) parts.push(`${s.smokes} smoke${s.smokes === 1 ? "" : "s"}`);
  if (s.mollys) parts.push(`${s.mollys} molly`);
  const other = s.total - s.smokes - s.mollys;
  if (other) parts.push(`${other} util`);
  return parts.join(" · ");
}

function attackerSide(replay: Replay, k: Kill): Side | null {
  if (k.attacker < 0) return null;
  return currentSide(replay, k.attacker, k.tick);
}

function nadeLandings(nades: GrenadeThrow[]): { x: number; y: number; z: number }[] {
  return nades.map(landing).filter((p): p is { x: number; y: number; z: number } => p != null);
}

function beatPlace(
  places: MapPlaces | null | undefined,
  tNades: GrenadeThrow[],
  ctNades: GrenadeThrow[],
  plant: { x: number; y: number; z: number } | null,
  at: { x: number; y: number; z?: number } | null,
): PlaceHit {
  let hit = placeFromLandings(places, nadeLandings(tNades));
  if (!hit.site && !hit.location) {
    hit = placeFromLandings(places, nadeLandings([...tNades, ...ctNades]));
  }
  if (!hit.site && !hit.location && plant) {
    hit = plantPlace(places, plant.x, plant.y, plant.z);
  }
  if (!hit.site && !hit.location && at) {
    hit = plant ? plantPlace(places, at.x, at.y, at.z) : placeAt(places, at.x, at.y, at.z);
  }
  return hit;
}

/** One team's util + kills + tags, or empty if that side did nothing. */
function sideBits(label: Side, nades: GrenadeThrow[], kills: number, extras: string[]): string {
  const parts: string[] = [];
  const nade = nadeBits(nades);
  if (nade) parts.push(nade);
  if (kills) parts.push(`${kills}k`);
  parts.push(...extras);
  if (parts.length === 0) return "";
  return `${label} ${parts.join(" · ")}`;
}

function beatsForRound(
  replay: Replay,
  round: Round,
  places: MapPlaces | null | undefined,
): ExecuteBeat[] {
  const rate = tps(replay);
  const from = round.freeze_end_tick || round.start_tick;
  const utilGap = Math.round(4 * rate);
  const killGap = Math.round(5 * rate);
  const mergeGap = Math.round(12 * rate);

  const nades = (replay.grenades ?? []).filter(
    (g) =>
      UTIL.has(g.kind) &&
      g.start_tick >= round.start_tick &&
      g.start_tick <= round.end_tick &&
      g.detonate_tick >= from &&
      g.detonate_tick <= round.end_tick,
  );
  const tNades = nades.filter(
    (g) => g.thrower >= 0 && currentSide(replay, g.thrower, g.detonate_tick) === "T",
  );
  const ctNades = nades.filter(
    (g) => g.thrower >= 0 && currentSide(replay, g.thrower, g.detonate_tick) === "CT",
  );

  const pulses: Pulse[] = [];
  for (const group of clusterUtil(tNades, utilGap)) {
    if (!isDump(group)) continue;
    pulses.push(
      withXY({ tick: group[0].detonate_tick, tag: "t-util", nades: group }, nadeCentroid(group)),
    );
  }
  for (const group of clusterUtil(ctNades, utilGap)) {
    if (!isDump(group)) continue;
    pulses.push(
      withXY({ tick: group[0].detonate_tick, tag: "ct-util", nades: group }, nadeCentroid(group)),
    );
  }

  const push = tPushTick(replay, round, places);
  if (push != null) pulses.push({ tick: push.tick, tag: "t-push", x: push.x, y: push.y });

  const plants = (replay.bombEvents ?? []).filter(
    (e) => e.kind === "planted" && inRound(round, e.tick),
  );
  const plantTick = plants[0]?.tick ?? null;
  if (plants[0]) {
    const pos = plantedBombPos(replay, plants[0]);
    pulses.push({
      tick: plants[0].tick,
      tag: "plant",
      x: pos.x,
      y: pos.y,
      z: pos.z,
    });
  }

  const kills = replay.kills.filter(
    (k) => isEnemyKill(replay, k) && k.tick >= from && k.tick <= round.end_tick,
  );
  for (const group of clusterByTick(kills, (k) => k.tick, killGap)) {
    if (group.length < 2) continue;
    const killXY = centroid(group.map((k) => ({ x: k.x, y: k.y })));
    pulses.push(
      withXY(
        { tick: group[0].tick, tag: "kills", kills: group },
        killXY ? { ...killXY, z: group.reduce((s, k) => s + k.z, 0) / group.length } : null,
      ),
    );
  }

  pulses.sort((a, b) => a.tick - b.tick);

  const windows: Pulse[][] = [];
  for (const p of pulses) {
    const last = windows[windows.length - 1];
    if (last && p.tick - last[last.length - 1].tick <= mergeGap && !tooFar(last, p)) {
      const splitAfterPlant =
        plantTick != null && p.tick > plantTick + rate && last[0].tick <= plantTick;
      if (splitAfterPlant) windows.push([p]);
      else last.push(p);
    } else windows.push([p]);
  }

  const beats: ExecuteBeat[] = [];
  for (const win of windows) {
    const action = win[0].tick;
    const tags = new Set(win.map((w) => w.tag));
    const afterPlant = plantTick != null && action > plantTick;
    const tNadesIn = win.filter((w) => w.tag === "t-util").flatMap((w) => w.nades ?? []);
    const ctNadesIn = win.filter((w) => w.tag === "ct-util").flatMap((w) => w.nades ?? []);
    const frags = win.flatMap((w) => w.kills ?? []);
    const tKillN = frags.filter((k) => attackerSide(replay, k) === "T").length;
    const ctKillN = frags.filter((k) => attackerSide(replay, k) === "CT").length;
    const killN = frags.length;
    const hasT = tags.has("t-util") || tags.has("t-push");
    const hasCt = tags.has("ct-util");
    const hasPlant = tags.has("plant");
    const dumped = tags.has("t-util");

    // CT util alone is usually defaulting (A smoke + B smoke, or one-site defaults).
    if (!hasT && !hasPlant && !(hasCt && afterPlant) && killN < 3) continue;

    let kind: ExecuteKind = "fight";
    let side: Side | null = null;
    let title = afterPlant ? "Post-plant" : "Fight";
    if (afterPlant && hasCt) {
      kind = "retake";
      side = "CT";
      title = "CT retake";
    } else if (hasT || (hasPlant && !hasCt)) {
      kind = hasPlant && !hasT ? "plant" : "execute";
      side = "T";
      if (hasPlant && dumped) title = "T execute";
      else if (hasPlant) title = "Plant";
      else if (dumped) title = "T execute";
      else title = "T push";
    } else if (hasCt && killN >= 3) {
      kind = "execute";
      side = "CT";
      title = "CT take";
    } else if (hasPlant) {
      kind = "plant";
      side = "T";
      title = "Plant";
    }

    const at = windowPoint(win);
    const plantPos = hasPlant && plants[0] ? plantedBombPos(replay, plants[0]) : null;
    const hit = beatPlace(places, tNadesIn, ctNadesIn, plantPos, at);
    const label = placeLabel(hit);
    if (label) title = `${title} · ${label}`;

    const bits = [
      sideBits("T", tNadesIn, tKillN, [...(hasPlant && kind !== "plant" ? ["plant"] : [])]),
      sideBits("CT", ctNadesIn, ctKillN, []),
      roundClock(replay, round, action),
    ];

    beats.push({
      tick: leadIn(replay, round, action),
      actionTick: action,
      round: round.number,
      roundLabel: roundLabel(round),
      kind,
      side,
      site: hit.site,
      location: hit.location,
      title,
      detail: bits.filter(Boolean).join(" · "),
    });
  }
  return beats;
}

let executeCache: { replay: Replay; key: string; beats: ExecuteBeat[] } | null = null;

function placesCacheKey(places: MapPlaces | null | undefined): string {
  if (!places || places.layout.callouts.length === 0) return "";
  return `${places.layout.map}:${places.layout.callouts.length}`;
}

/** Site hits / retakes — skip the slow default. Jump to `tick` (a couple of seconds of lead-in). */
export function findExecutes(replay: Replay, places?: MapPlaces | null): ExecuteBeat[] {
  const key = placesCacheKey(places);
  if (executeCache && executeCache.replay === replay && executeCache.key === key) {
    return executeCache.beats;
  }
  const out: ExecuteBeat[] = [];
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    out.push(...beatsForRound(replay, round, places));
  }
  executeCache = { replay, key, beats: out };
  return out;
}

export function nextExecuteTick(beats: ExecuteBeat[], tick: number, dir: 1 | -1): number | null {
  if (dir > 0) {
    const hit = beats.find((b) => b.tick > tick + 0.5);
    return hit?.tick ?? null;
  }
  for (let i = beats.length - 1; i >= 0; i--) {
    if (beats[i].tick < tick - 0.5) return beats[i].tick;
  }
  return null;
}

export interface ExecuteFilter {
  round?: number | null;
  side?: Side | "all";
  group?: string | "all";
  layout?: MapLayout | null;
  kinds?: ExecuteKind[];
}

export function filterExecutes(beats: ExecuteBeat[], filter: ExecuteFilter): ExecuteBeat[] {
  const kinds = filter.kinds && filter.kinds.length > 0 ? new Set(filter.kinds) : null;
  return beats.filter((b) => {
    if (filter.round != null && b.round !== filter.round) return false;
    if (filter.side && filter.side !== "all" && b.side !== filter.side) return false;
    if (filter.group && filter.group !== "all") {
      if (!placeMatchesLayoutGroup(b.location, b.site, filter.group, filter.layout)) return false;
    }
    if (kinds && !kinds.has(b.kind)) return false;
    return true;
  });
}

/** Beat currently on screen (lead-in through a few seconds after the action). */
export function activeExecute(beats: ExecuteBeat[], tick: number, tps: number): ExecuteBeat | null {
  const linger = (tps || 64) * 8;
  let hit: ExecuteBeat | null = null;
  for (const b of beats) {
    if (b.tick > tick) break;
    if (tick <= b.actionTick + linger) hit = b;
  }
  return hit;
}
