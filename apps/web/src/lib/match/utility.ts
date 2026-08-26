import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import { nadeLandPos } from "@/lib/radar/radarFx";
import { currentRound } from "@/lib/replay/sample";
import { siteCallout, type SiteCallout } from "./sites";
import { inKnifeRound, isEnemy } from "@/lib/stats/stats";
import type { Replay, Round } from "@/lib/replay/replayTypes";

export interface FlashBlindRow {
  tick: number;
  round: number;
  roundLabel: string;
  attacker: number;
  victim: number;
  attackerName: string;
  victimName: string;
  duration: number;
  enemy: boolean;
}

export interface HeDamageRow {
  tick: number;
  round: number;
  roundLabel: string;
  attacker: number;
  victim: number;
  attackerName: string;
  victimName: string;
  damage: number;
}

export interface SmokeThrowRow {
  tick: number;
  round: number;
  roundLabel: string;
  thrower: number;
  throwerName: string;
  site: SiteCallout | null;
  inSite: boolean;
}

export interface UtilitySummary {
  flashes: FlashBlindRow[];
  enemyFlashCount: number;
  he: HeDamageRow[];
  heDamage: number;
  smokes: SmokeThrowRow[];
  smokesThrown: number;
  smokesInSite: number;
  smokesA: number;
  smokesB: number;
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

function nameOf(replay: Replay, i: number): string {
  return i < 0 ? "World" : (replay.players[i]?.name ?? "?");
}

export function utilityThrough(
  replay: Replay,
  untilTick: number,
  player: number | null,
): UtilitySummary {
  const flashes: FlashBlindRow[] = [];
  for (const b of replay.blinds ?? []) {
    if (b.tick > untilTick || b.duration < MIN_REVIEW_FLASH_SECONDS) continue;
    if (inKnifeRound(replay, b.tick)) continue;
    if (player != null && b.attacker !== player && b.victim !== player) continue;
    const enemy = b.attacker >= 0 && b.victim >= 0 && isEnemy(replay, b.attacker, b.victim, b.tick);
    const meta = labelAt(replay, b.tick);
    flashes.push({
      tick: b.tick,
      round: meta.round,
      roundLabel: meta.roundLabel,
      attacker: b.attacker,
      victim: b.victim,
      attackerName: nameOf(replay, b.attacker),
      victimName: nameOf(replay, b.victim),
      duration: b.duration,
      enemy,
    });
  }

  const he: HeDamageRow[] = [];
  for (const h of replay.hurts ?? []) {
    if (h.tick > untilTick || h.damage <= 0 || !isHeGrenade(h.weapon)) continue;
    if (inKnifeRound(replay, h.tick)) continue;
    if (h.attacker < 0 || h.victim < 0) continue;
    if (!isEnemy(replay, h.attacker, h.victim, h.tick)) continue;
    if (player != null && h.attacker !== player && h.victim !== player) continue;
    const meta = labelAt(replay, h.tick);
    he.push({
      tick: h.tick,
      round: meta.round,
      roundLabel: meta.roundLabel,
      attacker: h.attacker,
      victim: h.victim,
      attackerName: nameOf(replay, h.attacker),
      victimName: nameOf(replay, h.victim),
      damage: h.damage,
    });
  }

  const smokes: SmokeThrowRow[] = [];
  const mapName = replay.header.map_name;
  for (const g of replay.grenades) {
    if (g.kind !== "smoke" || g.start_tick > untilTick) continue;
    if (inKnifeRound(replay, g.start_tick)) continue;
    if (player != null && g.thrower !== player) continue;
    const land = nadeLandPos(g);
    const z = g.points[g.points.length - 1]?.z;
    const site = land ? siteCallout(mapName, land.x, land.y, z) : null;
    const inSite = site === "A" || site === "B";
    const meta = labelAt(replay, g.start_tick);
    smokes.push({
      tick: g.start_tick,
      round: meta.round,
      roundLabel: meta.roundLabel,
      thrower: g.thrower,
      throwerName: nameOf(replay, g.thrower),
      site,
      inSite,
    });
  }

  return {
    flashes,
    enemyFlashCount: flashes.filter((f) => f.enemy).length,
    he,
    heDamage: he.reduce((n, r) => n + r.damage, 0),
    smokes,
    smokesThrown: smokes.length,
    smokesInSite: smokes.filter((s) => s.inSite).length,
    smokesA: smokes.filter((s) => s.site === "A").length,
    smokesB: smokes.filter((s) => s.site === "B").length,
  };
}
