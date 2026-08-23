import { samplePlayers } from "./sample";
import { currentSide, isEnemyKill } from "./stats";
import type { GrenadeThrow, Replay, Round, Side } from "./types";
import { formatClock } from "./weapons";

export type ExecuteKind = "execute" | "retake" | "plant" | "fight";

export interface ExecuteBeat {
  tick: number;
  actionTick: number;
  round: number;
  roundLabel: string;
  kind: ExecuteKind;
  side: Side | null;
  title: string;
  detail: string;
}

const UTIL = new Set(["smoke", "molotov", "flash", "he"]);
/** Same bombsite. Two defaults on opposite sides of the map stay split. */
const NADE_CLUSTER = 2000;
const PULSE_MERGE = 2400;

function tps(replay: Replay): number {
  return replay.header.tick_rate || 64;
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

function landing(g: GrenadeThrow): { x: number; y: number } | null {
  if (g.points.length === 0) return null;
  const hit = g.points.find((p) => p.tick === g.detonate_tick) ?? g.points[g.points.length - 1];
  return { x: hit.x, y: hit.y };
}

function centroid(pts: { x: number; y: number }[]): { x: number; y: number } | null {
  if (pts.length === 0) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function nadeCentroid(nades: GrenadeThrow[]): { x: number; y: number } | null {
  return centroid(nades.map(landing).filter((p): p is { x: number; y: number } => p != null));
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
    out.push(...spatialClusters(timed, NADE_CLUSTER));
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
  if (pts.length < 3) return null;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const spread = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length;
  return { n: pts.length, cx, cy, spread };
}

/** First tick Ts are stacked and have left spawn — a take, not a default. */
function tPushTick(replay: Replay, round: Round): { tick: number; x: number; y: number } | null {
  const rate = tps(replay);
  const freeze = round.freeze_end_tick || round.start_tick;
  const start = sideStats(replay, freeze, false);
  if (!start) return null;
  const from = freeze + rate * 8;
  const step = rate * 2;
  for (let tick = from; tick < round.end_tick; tick += step) {
    const now = sideStats(replay, tick, false);
    if (!now) continue;
    const moved = Math.hypot(now.cx - start.cx, now.cy - start.cy);
    if (now.n >= 3 && now.spread < 1100 && moved > 750) {
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
  kills?: number;
  x?: number;
  y?: number;
}

function pulseXY(p: Pulse): { x: number; y: number } | null {
  return p.x != null && p.y != null ? { x: p.x, y: p.y } : null;
}

function tooFar(window: Pulse[], next: Pulse): boolean {
  const b = pulseXY(next);
  if (!b) return false;
  const pts = window.map(pulseXY).filter((p): p is { x: number; y: number } => p != null);
  if (pts.length === 0) return false;
  return pts.every((a) => Math.hypot(a.x - b.x, a.y - b.y) > PULSE_MERGE);
}

function withXY(p: Pulse, xy: { x: number; y: number } | null): Pulse {
  return xy ? { ...p, x: xy.x, y: xy.y } : p;
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

function beatsForRound(replay: Replay, round: Round): ExecuteBeat[] {
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

  const push = tPushTick(replay, round);
  if (push != null) pulses.push({ tick: push.tick, tag: "t-push", x: push.x, y: push.y });

  const plants = (replay.bombEvents ?? []).filter(
    (e) => e.kind === "planted" && inRound(round, e.tick),
  );
  const plantTick = plants[0]?.tick ?? null;
  if (plants[0]) {
    pulses.push({ tick: plants[0].tick, tag: "plant", x: plants[0].x, y: plants[0].y });
  }

  const kills = replay.kills.filter(
    (k) => isEnemyKill(replay, k) && k.tick >= from && k.tick <= round.end_tick,
  );
  for (const group of clusterByTick(kills, (k) => k.tick, killGap)) {
    if (group.length < 2) continue;
    pulses.push(
      withXY(
        { tick: group[0].tick, tag: "kills", kills: group.length },
        centroid(group.map((k) => ({ x: k.x, y: k.y }))),
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
    const nadesIn = win.flatMap((w) => w.nades ?? []);
    const killN = win.reduce((s, w) => s + (w.kills ?? 0), 0);
    const hasT = tags.has("t-util") || tags.has("t-push");
    const hasCt = tags.has("ct-util");
    const hasPlant = tags.has("plant");

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
      title = hasPlant && hasT ? "T execute" : hasPlant ? "Plant" : "T execute";
    } else if (hasCt && killN >= 3) {
      kind = "execute";
      side = "CT";
      title = "CT take";
    } else if (hasPlant) {
      kind = "plant";
      side = "T";
      title = "Plant";
    }

    const bits = [nadeBits(nadesIn)];
    if (killN) bits.push(`${killN}k`);
    if (tags.has("t-push")) bits.push("stack");
    if (hasPlant && kind !== "plant") bits.push("plant");
    bits.push(roundClock(replay, round, action));

    beats.push({
      tick: leadIn(replay, round, action),
      actionTick: action,
      round: round.number,
      roundLabel: roundLabel(round),
      kind,
      side,
      title,
      detail: bits.filter(Boolean).join(" · "),
    });
  }
  return beats;
}

let executeCache: { replay: Replay; beats: ExecuteBeat[] } | null = null;

/** Site hits / retakes — skip the slow default. Jump to `tick` (a couple of seconds of lead-in). */
export function findExecutes(replay: Replay): ExecuteBeat[] {
  if (executeCache && executeCache.replay === replay) return executeCache.beats;
  const out: ExecuteBeat[] = [];
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    out.push(...beatsForRound(replay, round));
  }
  executeCache = { replay, beats: out };
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
