import {
  FLASH_BLIND_ATTRIBUTION_SECONDS,
  FLASH_ONSET_RISE_SECONDS,
  FLASH_OVERLAY_SPIKE_SECONDS,
  MOLOTOV_SECONDS,
  tickRate,
} from "@/lib/shared/constants";
import { nadeLandPos } from "@/lib/radar/radarFx";
import { NADE_LABEL } from "@/lib/match/roundEvents";
import { currentRound, samplePlayer } from "@/lib/replay/sample";
import { calloutsInLocation, placeAt, type MapPlaces, type SiteCallout } from "./sites";
import { clusterLayoutCallouts, groupLabel, type MapLayout } from "@/lib/radar/layouts";
import { inKnifeRound, isEnemy } from "@/lib/stats/stats";
import type { GrenadeKind, GrenadeThrow, Replay, Round } from "@/lib/replay/replayTypes";
import { isFireGrenade, nadeFilterKind } from "@/lib/replay/replayTypes";

/** Chip / summary order — fire nades collapse to a single Molly entry. */
const FILTER_KIND_ORDER: GrenadeKind[] = ["smoke", "flash", "he", "molotov", "decoy"];

export interface UtilBlind {
  victim: number;
  victimName: string;
  duration: number;
  enemy: boolean;
}

export interface UtilHit {
  victim: number;
  victimName: string;
  damage: number;
  enemy: boolean;
}

export interface UtilThrowRow {
  tick: number;
  detonateTick: number;
  endTick: number;
  round: number;
  roundLabel: string;
  kind: GrenadeKind;
  thrower: number;
  throwerName: string;
  site: SiteCallout | null;
  location: string | null;
  inSite: boolean;
  blinds: UtilBlind[];
  hits: UtilHit[];
}

export interface UtilitySummary {
  throws: UtilThrowRow[];
  byKind: Record<GrenadeKind, number>;
  enemyFlashCount: number;
  heDamage: number;
  inSite: number;
  nadesA: number;
  nadesB: number;
}

function emptyKindCounts(): Record<GrenadeKind, number> {
  return { smoke: 0, flash: 0, he: 0, molotov: 0, incendiary: 0, decoy: 0 };
}

function roundLabel(r: Round): string {
  return r.is_knife ? "Knife" : `R${r.number}`;
}

function labelAt(replay: Replay, tick: number): { round: number; roundLabel: string } {
  const r = currentRound(replay, tick);
  if (!r) return { round: 0, roundLabel: "—" };
  return { round: r.number, roundLabel: roundLabel(r) };
}

function isHeGrenade(weapon: string): boolean {
  return weapon.toLowerCase().includes("hegrenade");
}

function isMollyWeapon(weapon: string): boolean {
  const w = weapon.toLowerCase();
  return (
    w.includes("inferno") ||
    w.includes("molotov") ||
    w.includes("incgrenade") ||
    w.includes("incendiary")
  );
}

function rowDamage(row: UtilThrowRow): number {
  return row.hits.reduce((n, hit) => n + hit.damage, 0);
}

function addHit(
  row: UtilThrowRow,
  replay: Replay,
  victim: number,
  damage: number,
  tick: number,
): void {
  const existing = row.hits.find((hit) => hit.victim === victim);
  if (existing) {
    existing.damage += damage;
    return;
  }
  row.hits.push({
    victim,
    victimName: nameOf(replay, victim),
    damage,
    enemy: row.thrower >= 0 && victim >= 0 && isEnemy(replay, row.thrower, victim, tick),
  });
}

function overlaySpike(duration: number): boolean {
  return duration >= FLASH_OVERLAY_SPIKE_SECONDS;
}

/** Peak real pop. Overlay-only snaps (~5.1s) return 0 so the chip is omitted. */
export function pickFlashDuration(durations: readonly number[]): number {
  if (durations.length === 0) return 0;
  const real = durations.filter((duration) => !overlaySpike(duration));
  if (real.length === 0) return 0;
  return real.reduce((best, duration) => (duration > best ? duration : best));
}

/** One chip per victim: player_blind + pawn flash samples otherwise stack. */
function addBlind(
  row: UtilThrowRow,
  replay: Replay,
  victim: number,
  duration: number,
  tick: number,
): void {
  const existing = row.blinds.find((blind) => blind.victim === victim);
  if (existing) {
    const next = pickFlashDuration([existing.duration, duration]);
    if (next > 0) existing.duration = next;
    return;
  }
  const picked = pickFlashDuration([duration]);
  if (picked <= 0) return;
  row.blinds.push({
    victim,
    victimName: nameOf(replay, victim),
    duration: picked,
    enemy: row.thrower >= 0 && victim >= 0 && isEnemy(replay, row.thrower, victim, tick),
  });
}

function attachEndTick(row: UtilThrowRow, tps: number): number {
  if (isFireGrenade(row.kind)) {
    return Math.max(row.endTick, row.detonateTick + Math.round(MOLOTOV_SECONDS * tps));
  }
  return row.endTick;
}

function flashBlindWindowEnd(row: UtilThrowRow, tps: number): number {
  return row.detonateTick + Math.round(FLASH_BLIND_ATTRIBUTION_SECONDS * tps);
}

function nearestInWindow(
  rows: UtilThrowRow[],
  attacker: number,
  tick: number,
  startTick: (row: UtilThrowRow) => number,
  endTick: (row: UtilThrowRow) => number,
): UtilThrowRow | null {
  let best: UtilThrowRow | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (tick < startTick(row) || tick > endTick(row)) continue;
    if (attacker >= 0 && row.thrower >= 0 && row.thrower !== attacker) continue;
    const dist = Math.abs(tick - row.detonateTick);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return best;
}

function nearestThrow(
  rows: UtilThrowRow[],
  attacker: number,
  tick: number,
  tps: number,
): UtilThrowRow | null {
  return nearestInWindow(
    rows,
    attacker,
    tick,
    (row) => row.tick,
    (row) => attachEndTick(row, tps),
  );
}

function flashWindowHas(row: UtilThrowRow, tick: number, tps: number): boolean {
  return tick >= row.detonateTick && tick <= flashBlindWindowEnd(row, tps);
}

/** Latest already-popped flash in the window; prefer the recorded thrower. */
function pickFlashForBlind(
  flashes: UtilThrowRow[],
  attacker: number,
  tick: number,
  tps: number,
): UtilThrowRow | null {
  const inWindow = flashes.filter((row) => flashWindowHas(row, tick, tps));
  const matched = attacker >= 0 ? inWindow.filter((row) => row.thrower === attacker) : [];
  const pool = matched.length > 0 ? matched : inWindow;
  let best: UtilThrowRow | null = null;
  for (const row of pool) {
    if (!best || row.detonateTick > best.detonateTick) best = row;
  }
  return best;
}

interface VictimOnset {
  row: UtilThrowRow;
  peak: number;
  lastDuration: number;
  onsetTick: number;
}

function isFreshOnset(
  prev: VictimOnset,
  duration: number,
  tick: number,
  candidate: UtilThrowRow,
  tps: number,
): boolean {
  if (prev.row === candidate) return true;
  if (candidate.detonateTick <= prev.row.detonateTick) return false;
  const remaining = prev.peak - (tick - prev.onsetTick) / tps;
  if (remaining <= 0) return true;
  return duration > prev.lastDuration + FLASH_ONSET_RISE_SECONDS;
}

/** Dead / missing pawns still report leftover `m_flFlashDuration`; skip those. */
function victimAliveAt(replay: Replay, victim: number, tick: number): boolean {
  if (replay.ticks.frameCount === 0 || replay.ticks.playerCount === 0) return true;
  const snap = samplePlayer(replay, victim, tick);
  return snap != null && snap.present && snap.alive;
}

function nameOf(replay: Replay, i: number): string {
  return i < 0 ? "World" : (replay.players[i]?.name ?? "?");
}

function attachBlinds(rows: UtilThrowRow[], replay: Replay, untilTick: number): void {
  const flashes = rows.filter((row) => row.kind === "flash");
  if (flashes.length === 0) return;
  const tps = tickRate(replay);
  const onsets = new Map<number, VictimOnset>();
  const blinds = (replay.blinds ?? [])
    .filter(
      (blind) =>
        blind.tick <= untilTick &&
        blind.duration > 0 &&
        !overlaySpike(blind.duration) &&
        !inKnifeRound(replay, blind.tick),
    )
    .slice()
    .sort((a, b) => a.tick - b.tick || a.victim - b.victim);

  for (const blind of blinds) {
    const candidate = pickFlashForBlind(flashes, blind.attacker, blind.tick, tps);
    if (!candidate) continue;
    if (!victimAliveAt(replay, blind.victim, candidate.detonateTick)) continue;
    if (!victimAliveAt(replay, blind.victim, blind.tick)) continue;
    const prev = onsets.get(blind.victim);
    const row =
      prev && !isFreshOnset(prev, blind.duration, blind.tick, candidate, tps)
        ? prev.row
        : candidate;
    addBlind(row, replay, blind.victim, blind.duration, blind.tick);
    const attached = row.blinds.find((entry) => entry.victim === blind.victim);
    if (!attached) continue;
    const same = prev?.row === row;
    onsets.set(blind.victim, {
      row,
      peak: attached.duration,
      lastDuration: blind.duration,
      onsetTick: same && prev ? prev.onsetTick : blind.tick,
    });
  }
}

function attachDamage(rows: UtilThrowRow[], replay: Replay, untilTick: number): void {
  const hes = rows.filter((row) => row.kind === "he");
  const mollys = rows.filter((row) => isFireGrenade(row.kind));
  if (hes.length === 0 && mollys.length === 0) return;
  const tps = tickRate(replay);
  for (const hurt of replay.hurts ?? []) {
    if (hurt.tick > untilTick || hurt.damage <= 0) continue;
    if (inKnifeRound(replay, hurt.tick)) continue;
    if (hurt.attacker < 0 || hurt.victim < 0) continue;
    if (!isEnemy(replay, hurt.attacker, hurt.victim, hurt.tick)) continue;
    const pool = isHeGrenade(hurt.weapon) ? hes : isMollyWeapon(hurt.weapon) ? mollys : null;
    if (!pool) continue;
    const best = nearestThrow(pool, hurt.attacker, hurt.tick, tps);
    if (best) addHit(best, replay, hurt.victim, hurt.damage, hurt.tick);
  }
}

let utilBaseCache: WeakMap<Replay, Map<string, UtilThrowRow[]>> | null = null;
let utilRoundCache: WeakMap<Replay, Map<string, Map<number, UtilThrowRow[]>>> | null = null;

function utilBaseCacheFor(replay: Replay): Map<string, UtilThrowRow[]> {
  if (!utilBaseCache) utilBaseCache = new WeakMap();
  let byPlaces = utilBaseCache.get(replay);
  if (!byPlaces) {
    byPlaces = new Map();
    utilBaseCache.set(replay, byPlaces);
  }
  return byPlaces;
}

function utilRoundCacheFor(replay: Replay): Map<string, Map<number, UtilThrowRow[]>> {
  if (!utilRoundCache) utilRoundCache = new WeakMap();
  let byPlaces = utilRoundCache.get(replay);
  if (!byPlaces) {
    byPlaces = new Map();
    utilRoundCache.set(replay, byPlaces);
  }
  return byPlaces;
}

/** Drop cached util rows for one replay (tests). */
export function clearUtilCache(replay?: Replay): void {
  if (!utilBaseCache && !utilRoundCache) return;
  if (replay) {
    utilBaseCache?.delete(replay);
    utilRoundCache?.delete(replay);
    return;
  }
  utilBaseCache = new WeakMap();
  utilRoundCache = new WeakMap();
}

function placesCacheKey(places: MapPlaces | null | undefined): string {
  if (!places || places.layout.callouts.length === 0) return "";
  return `${places.layout.map}:${places.layout.callouts.length}`;
}

function cloneUtilRow(row: UtilThrowRow): UtilThrowRow {
  return { ...row, blinds: [], hits: [] };
}

function buildBaseUtilThrows(replay: Replay, places?: MapPlaces | null): UtilThrowRow[] {
  const throws: UtilThrowRow[] = [];
  for (const nade of replay.grenades) {
    if (inKnifeRound(replay, nade.start_tick)) continue;
    throws.push(fromThrow(replay, nade, places));
  }
  throws.sort((a, b) => a.tick - b.tick || a.detonateTick - b.detonateTick);
  return throws;
}

function baseUtilThrows(replay: Replay, places?: MapPlaces | null): UtilThrowRow[] {
  const key = placesCacheKey(places);
  const byPlaces = utilBaseCacheFor(replay);
  const hit = byPlaces.get(key);
  if (hit) return hit;
  const out = buildBaseUtilThrows(replay, places);
  byPlaces.set(key, out);
  return out;
}

function buildRoundUtilCache(
  replay: Replay,
  places?: MapPlaces | null,
): Map<number, UtilThrowRow[]> {
  const grouped = new Map<number, UtilThrowRow[]>();
  for (const row of baseUtilThrows(replay, places)) {
    let list = grouped.get(row.round);
    if (!list) {
      list = [];
      grouped.set(row.round, list);
    }
    list.push(cloneUtilRow(row));
  }
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    const rows = grouped.get(round.number);
    if (!rows || rows.length === 0) continue;
    attachBlinds(rows, replay, round.end_tick);
    attachDamage(rows, replay, round.end_tick);
  }
  return grouped;
}

/** All util throws in one round, with blinds/damage through round end (cached per replay). */
export function utilThrowsForRound(
  replay: Replay,
  roundNumber: number,
  places?: MapPlaces | null,
): UtilThrowRow[] {
  const key = placesCacheKey(places);
  const byPlaces = utilRoundCacheFor(replay);
  let byRound = byPlaces.get(key);
  if (!byRound) {
    byRound = buildRoundUtilCache(replay, places);
    byPlaces.set(key, byRound);
  }
  return byRound.get(roundNumber) ?? [];
}

function fromThrow(replay: Replay, nade: GrenadeThrow, places?: MapPlaces | null): UtilThrowRow {
  const land = nadeLandPos(nade);
  const z = nade.points[nade.points.length - 1]?.z;
  const hit = land ? placeAt(places, land.x, land.y, z) : { site: null, location: null };
  const meta = labelAt(replay, nade.start_tick);
  return {
    tick: nade.start_tick,
    detonateTick: nade.detonate_tick,
    endTick: nade.end_tick,
    round: meta.round,
    roundLabel: meta.roundLabel,
    kind: nade.kind,
    thrower: nade.thrower,
    throwerName: nameOf(replay, nade.thrower),
    site: hit.site,
    location: hit.location,
    inSite: hit.site === "A" || hit.site === "B",
    blinds: [],
    hits: [],
  };
}

export function utilityThrough(
  replay: Replay,
  untilTick: number,
  player: number | null,
  places?: MapPlaces | null,
): UtilitySummary {
  const throws: UtilThrowRow[] = [];
  const byKind = emptyKindCounts();
  for (const row of baseUtilThrows(replay, places)) {
    if (row.tick > untilTick) continue;
    if (player != null && row.thrower !== player) continue;
    byKind[row.kind] += 1;
    throws.push(cloneUtilRow(row));
  }
  attachBlinds(throws, replay, untilTick);
  attachDamage(throws, replay, untilTick);

  return {
    throws,
    byKind,
    enemyFlashCount: throws.reduce(
      (n, row) => n + row.blinds.filter((blind) => blind.enemy).length,
      0,
    ),
    heDamage: throws.reduce((n, row) => n + rowDamage(row), 0),
    inSite: throws.filter((row) => row.inSite).length,
    nadesA: throws.filter((row) => row.site === "A").length,
    nadesB: throws.filter((row) => row.site === "B").length,
  };
}

export function utilKindSummary(byKind: Record<GrenadeKind, number>): string {
  return FILTER_KIND_ORDER.filter((kind) => {
    if (kind === "molotov") return byKind.molotov + byKind.incendiary > 0;
    return byKind[kind] > 0;
  })
    .map((kind) => {
      const n = kind === "molotov" ? byKind.molotov + byKind.incendiary : byKind[kind];
      return `${n} ${NADE_LABEL[kind]}`;
    })
    .join(" · ");
}

export function formatBlind(blind: UtilBlind): string {
  return `${blind.victimName} ${blind.duration.toFixed(1)}s`;
}

export function formatUtilHit(hit: UtilHit): string {
  return `${hit.victimName} (${hit.damage})`;
}

export function splitUtilBlinds(blinds: UtilBlind[]): { enemy: UtilBlind[]; team: UtilBlind[] } {
  return {
    enemy: blinds.filter((blind) => blind.enemy),
    team: blinds.filter((blind) => !blind.enemy),
  };
}

function flashBlindDetail(blinds: UtilBlind[]): string {
  const { enemy, team } = splitUtilBlinds(blinds);
  if (enemy.length > 0 && team.length > 0) {
    return `Enemy: ${enemy.map(formatBlind).join(" · ")} · Team: ${team.map(formatBlind).join(" · ")}`;
  }
  return blinds.map(formatBlind).join(" · ");
}

/** Colour only from who was hit or flashed. Misses stay white (site is already on the row). */
export function utilRowTone(row: UtilThrowRow): "" | "good" | "high" | "mixed" {
  if (row.kind === "flash") {
    const enemies = row.blinds.some((blind) => blind.enemy);
    const team = row.blinds.some((blind) => !blind.enemy);
    if (enemies && team) return "mixed";
    if (enemies) return "good";
    if (team) return "high";
    return "";
  }
  if (row.hits.some((hit) => hit.enemy)) return "good";
  return "";
}

export function throwDetail(row: UtilThrowRow): string {
  const parts: string[] = [];
  if (row.blinds.length > 0) {
    parts.push(flashBlindDetail(row.blinds));
  }
  if (row.hits.length > 0) {
    parts.push(row.hits.map(formatUtilHit).join(", "));
  }
  return parts.join(" · ");
}

export function usedUtilKinds(rows: UtilThrowRow[]): GrenadeKind[] {
  return FILTER_KIND_ORDER.filter((kind) => rows.some((row) => nadeFilterKind(row.kind) === kind));
}

/** True when the util kind chips include this throw (Molly chip covers Incendiary). */
export function utilKindSelected(selected: GrenadeKind[], kind: GrenadeKind): boolean {
  if (selected.length === 0) return true;
  return selected.includes(nadeFilterKind(kind));
}

export interface UtilPlaceChip {
  key: string;
  label: string;
  names: string[];
}

/** Top-level groups first (any member used), then leftover ungrouped names. */
export function usedUtilPlaces(rows: UtilThrowRow[], layout?: MapLayout | null): UtilPlaceChip[] {
  const used = new Set<string>();
  for (const row of rows) {
    for (const name of calloutsInLocation(row.location)) used.add(name);
  }
  if (used.size === 0) return [];
  const chips: UtilPlaceChip[] = [];
  const seen = new Set<string>();
  for (const cluster of layout ? clusterLayoutCallouts(layout) : []) {
    if (cluster.group) {
      const names = cluster.callouts.map((c) => c.name);
      if (!names.some((name) => used.has(name))) continue;
      chips.push({ key: `group:${cluster.group}`, label: groupLabel(cluster.group), names });
      for (const name of names) seen.add(name);
      continue;
    }
    for (const callout of cluster.callouts) {
      if (!used.has(callout.name) || seen.has(callout.name)) continue;
      chips.push({ key: `callout:${callout.name}`, label: callout.name, names: [callout.name] });
      seen.add(callout.name);
    }
  }
  for (const name of [...used].sort((a, b) => a.localeCompare(b))) {
    if (seen.has(name)) continue;
    chips.push({ key: `callout:${name}`, label: name, names: [name] });
  }
  return chips;
}

export function utilMatchesCallout(row: UtilThrowRow, callout: string): boolean {
  return calloutsInLocation(row.location).includes(callout);
}

export function utilMatchesPlace(row: UtilThrowRow, chip: UtilPlaceChip): boolean {
  const names = calloutsInLocation(row.location);
  return chip.names.some((name) => names.includes(name));
}
