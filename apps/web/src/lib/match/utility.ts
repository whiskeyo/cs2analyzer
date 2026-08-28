import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import { nadeLandPos } from "@/lib/radar/radarFx";
import { NADE_LABEL } from "@/lib/match/roundEvents";
import { currentRound } from "@/lib/replay/sample";
import { calloutsInLocation, placeAt, type MapPlaces, type SiteCallout } from "./sites";
import { clusterLayoutCallouts, groupLabel, type MapLayout } from "@/lib/radar/layouts";
import { inKnifeRound, isEnemy } from "@/lib/stats/stats";
import type { GrenadeKind, GrenadeThrow, Replay, Round } from "@/lib/replay/replayTypes";

const KIND_ORDER: GrenadeKind[] = ["smoke", "flash", "he", "molotov", "decoy"];

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
  return { smoke: 0, flash: 0, he: 0, molotov: 0, decoy: 0 };
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
  return w.includes("inferno") || w.includes("molotov") || w.includes("incgrenade");
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

function nearestThrow(rows: UtilThrowRow[], attacker: number, tick: number): UtilThrowRow | null {
  let best: UtilThrowRow | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (row.thrower !== attacker || !coversTick(row, tick)) continue;
    const dist = Math.abs(tick - row.detonateTick);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return best;
}

function nameOf(replay: Replay, i: number): string {
  return i < 0 ? "World" : (replay.players[i]?.name ?? "?");
}

function coversTick(row: UtilThrowRow, tick: number): boolean {
  return tick >= row.tick && tick <= row.endTick;
}

function attachBlinds(rows: UtilThrowRow[], replay: Replay, untilTick: number): void {
  const flashes = rows.filter((row) => row.kind === "flash");
  if (flashes.length === 0) return;
  for (const blind of replay.blinds ?? []) {
    if (blind.tick > untilTick || blind.duration < MIN_REVIEW_FLASH_SECONDS) continue;
    if (inKnifeRound(replay, blind.tick)) continue;
    const best = nearestThrow(flashes, blind.attacker, blind.tick);
    if (!best) continue;
    best.blinds.push({
      victim: blind.victim,
      victimName: nameOf(replay, blind.victim),
      duration: blind.duration,
      enemy:
        blind.attacker >= 0 &&
        blind.victim >= 0 &&
        isEnemy(replay, blind.attacker, blind.victim, blind.tick),
    });
  }
}

function attachDamage(rows: UtilThrowRow[], replay: Replay, untilTick: number): void {
  const hes = rows.filter((row) => row.kind === "he");
  const mollys = rows.filter((row) => row.kind === "molotov");
  if (hes.length === 0 && mollys.length === 0) return;
  for (const hurt of replay.hurts ?? []) {
    if (hurt.tick > untilTick || hurt.damage <= 0) continue;
    if (inKnifeRound(replay, hurt.tick)) continue;
    if (hurt.attacker < 0 || hurt.victim < 0) continue;
    if (!isEnemy(replay, hurt.attacker, hurt.victim, hurt.tick)) continue;
    const pool = isHeGrenade(hurt.weapon) ? hes : isMollyWeapon(hurt.weapon) ? mollys : null;
    if (!pool) continue;
    const best = nearestThrow(pool, hurt.attacker, hurt.tick);
    if (best) addHit(best, replay, hurt.victim, hurt.damage, hurt.tick);
  }
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
  for (const nade of replay.grenades) {
    if (nade.start_tick > untilTick) continue;
    if (inKnifeRound(replay, nade.start_tick)) continue;
    if (player != null && nade.thrower !== player) continue;
    const row = fromThrow(replay, nade, places);
    byKind[row.kind] += 1;
    throws.push(row);
  }
  throws.sort((a, b) => a.tick - b.tick || a.detonateTick - b.detonateTick);
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
  return KIND_ORDER.filter((kind) => byKind[kind] > 0)
    .map((kind) => `${byKind[kind]} ${NADE_LABEL[kind]}`)
    .join(" · ");
}

export function throwDetail(row: UtilThrowRow): string {
  const parts: string[] = [];
  if (row.blinds.length > 0) {
    parts.push(
      row.blinds.map((blind) => `${blind.victimName} ${blind.duration.toFixed(1)}s`).join(" · "),
    );
  }
  if (row.hits.length > 0) {
    parts.push(row.hits.map((hit) => `${hit.victimName} (${hit.damage})`).join(", "));
  }
  return parts.join(" · ");
}

export function usedUtilKinds(rows: UtilThrowRow[]): GrenadeKind[] {
  return KIND_ORDER.filter((kind) => rows.some((row) => row.kind === kind));
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
