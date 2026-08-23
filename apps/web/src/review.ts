import { samplePlayers } from "./sample";
import { currentSide } from "./stats";
import type { Kill, Replay, Round } from "./types";
import { GEAR_DECOY, GEAR_FLASH, GEAR_FLASH2, GEAR_HE, GEAR_MOLLY, GEAR_SMOKE } from "./types";
import { prettyWeapon } from "./weapons";

const TRADE_SECONDS = 5;
const NADE_GEAR = GEAR_HE | GEAR_FLASH | GEAR_FLASH2 | GEAR_SMOKE | GEAR_MOLLY | GEAR_DECOY;

export type ReviewSeverity = "high" | "mid" | "low";

export interface ReviewHeadline {
  text: string;
  severity: ReviewSeverity;
  count: number;
}

export interface ReviewNote {
  tick: number;
  roundLabel: string;
  title: string;
  detail: string;
  severity: ReviewSeverity;
}

export interface PlayerReview {
  headlines: ReviewHeadline[];
  notes: ReviewNote[];
}

function roundLabel(r: Round): string {
  return r.is_knife ? "Knife" : `R${r.number}`;
}

function isUtil(weapon: string): boolean {
  const w = weapon.toLowerCase();
  return (
    w.includes("hegrenade") ||
    w.includes("inferno") ||
    w.includes("molotov") ||
    w.includes("incgrenade")
  );
}

function flashedAt(
  replay: Replay,
  player: number,
  tick: number,
): { by: number; duration: number } | null {
  const tps = replay.header.tick_rate || 64;
  let hit: { by: number; duration: number } | null = null;
  for (const b of replay.blinds ?? []) {
    if (b.victim !== player || b.duration < 0.4) continue;
    const end = b.tick + b.duration * tps;
    if (tick >= b.tick && tick <= end) {
      hit = { by: b.attacker, duration: b.duration };
      const same = currentSide(replay, b.attacker, tick) === currentSide(replay, player, tick);
      if (!same) return hit;
    }
  }
  return hit;
}

function traded(replay: Replay, death: Kill, untilTick: number): boolean {
  if (death.attacker < 0) return false;
  const tps = replay.header.tick_rate || 64;
  const window = Math.round(TRADE_SECONDS * tps);
  const side = currentSide(replay, death.victim, death.tick);
  for (const k of replay.kills) {
    if (k.tick <= death.tick || k.tick > death.tick + window || k.tick > untilTick) continue;
    if (k.victim !== death.attacker || k.attacker < 0) continue;
    if (currentSide(replay, k.attacker, k.tick) === side) return true;
  }
  return false;
}

function dmgTo(replay: Replay, attacker: number, victim: number, from: number, to: number): number {
  let n = 0;
  for (const h of replay.hurts ?? []) {
    if (h.tick < from || h.tick > to) continue;
    if (h.attacker === attacker && h.victim === victim) n += h.damage;
  }
  return n;
}

function aliveOnSide(replay: Replay, tick: number, side: "T" | "CT", except: number): number {
  let n = 0;
  for (const p of samplePlayers(replay, tick)) {
    if (!p.present || !p.alive || p.index === except) continue;
    if ((p.ct ? "CT" : "T") === side) n += 1;
  }
  return n;
}

function nadeCount(gear: number): number {
  let n = 0;
  if (gear & GEAR_HE) n += 1;
  if (gear & GEAR_FLASH) n += 1;
  if (gear & GEAR_FLASH2) n += 1;
  if (gear & GEAR_SMOKE) n += 1;
  if (gear & GEAR_MOLLY) n += 1;
  if (gear & GEAR_DECOY) n += 1;
  return n;
}

export function playerReview(replay: Replay, player: number, untilTick: number): PlayerReview {
  const notes: ReviewNote[] = [];
  const name = (i: number) => (i < 0 ? "World" : (replay.players[i]?.name ?? "?"));
  let opening = 0;
  let openingLoss = 0;
  let untraded = 0;
  let flashed = 0;
  let utilDeaths = 0;
  let clutchLoss = 0;
  let fedMulti = 0;
  let noReturn = 0;
  let nadesLeft = 0;

  for (const r of replay.rounds) {
    if (r.is_knife) continue;
    const end = Math.min(r.end_tick, untilTick);
    if (r.freeze_end_tick > untilTick) continue;
    const roundKills = replay.kills.filter((k) => k.tick >= r.freeze_end_tick && k.tick <= end);
    const first = roundKills[0];
    const myDeaths = roundKills.filter((k) => k.victim === player);
    const side = currentSide(replay, player, r.freeze_end_tick || r.start_tick);
    const teamLost = r.end_tick <= untilTick && r.winner != null && r.winner !== side;

    for (const k of myDeaths) {
      if (k.attacker === player) continue;
      const killer = name(k.attacker);
      const gun = prettyWeapon(k.weapon);
      const bits: string[] = [];
      let severity: ReviewSeverity = "low";

      const openingDeath = first != null && first.tick === k.tick && first.victim === player;
      if (openingDeath) {
        opening += 1;
        bits.push("opening death");
        severity = "high";
        if (teamLost) openingLoss += 1;
      }

      if (k.attacker >= 0 && !traded(replay, k, untilTick)) {
        untraded += 1;
        bits.push("untraded");
        if (severity !== "high") severity = "mid";
      }

      const flash = flashedAt(replay, player, k.tick);
      if (flash) {
        flashed += 1;
        const by = flash.by >= 0 && flash.by !== player ? ` by ${name(flash.by)}` : "";
        bits.push(`flashed${by} (${flash.duration.toFixed(1)}s)`);
        severity = "high";
      }

      if (isUtil(k.weapon)) {
        utilDeaths += 1;
        bits.push(`died to ${gun}`);
        if (severity === "low") severity = "mid";
      }

      const pre = Math.max(r.freeze_end_tick, k.tick - 8);
      const teammates = aliveOnSide(replay, pre, side, player);
      const enemies = aliveOnSide(replay, pre, side === "CT" ? "T" : "CT", -1);
      if (teammates === 0 && enemies >= 1) {
        clutchLoss += 1;
        bits.push(`lost 1v${enemies}`);
        severity = "high";
      }

      if (k.attacker >= 0) {
        const killerKills = roundKills.filter((x) => x.attacker === k.attacker).length;
        if (killerKills >= 3) {
          fedMulti += 1;
          bits.push(`fed a ${killerKills}k`);
          if (severity === "low") severity = "mid";
        }
        const dealt = dmgTo(replay, player, k.attacker, r.freeze_end_tick, k.tick);
        if (!isUtil(k.weapon) && dealt < 25) {
          noReturn += 1;
          bits.push(dealt > 0 ? `only ${dealt} dmg back` : "no damage back");
          if (severity === "low") severity = "mid";
        }
      }

      const load = samplePlayers(replay, pre).find((p) => p.index === player);
      if (load && (load.gear & NADE_GEAR) !== 0) {
        const n = nadeCount(load.gear);
        if (n >= 2) {
          nadesLeft += 1;
          bits.push(`died holding ${n} nades`);
        }
      }

      if (teamLost) bits.push("round lost");

      const title = openingDeath
        ? `Lost the opening to ${killer}`
        : teammates === 0 && enemies >= 1
          ? `Lost a 1v${enemies} to ${killer}`
          : `Died to ${killer}`;

      notes.push({
        tick: k.tick,
        roundLabel: roundLabel(r),
        title,
        detail: [gun + (k.headshot ? " HS" : ""), ...bits].join(" · "),
        severity,
      });
    }
  }

  const headlines: ReviewHeadline[] = [];
  const push = (count: number, severity: ReviewSeverity, text: string) => {
    if (count > 0) headlines.push({ count, severity, text });
  };
  push(
    opening,
    "high",
    openingLoss
      ? `Lost ${opening} opening duel${opening === 1 ? "" : "s"} (${openingLoss} in rounds the team lost)`
      : `Lost ${opening} opening duel${opening === 1 ? "" : "s"}`,
  );
  push(flashed, "high", `Died flashed ${flashed} time${flashed === 1 ? "" : "s"}`);
  push(clutchLoss, "high", `Lost ${clutchLoss} clutch${clutchLoss === 1 ? "" : "es"}`);
  push(untraded, "mid", `${untraded} untraded death${untraded === 1 ? "" : "s"}`);
  push(
    noReturn,
    "mid",
    `${noReturn} gunfight${noReturn === 1 ? "" : "s"} with almost no damage back`,
  );
  push(fedMulti, "mid", `Fed ${fedMulti} multi-kill${fedMulti === 1 ? "" : "s"}`);
  push(utilDeaths, "mid", `Died to utility ${utilDeaths} time${utilDeaths === 1 ? "" : "s"}`);
  push(
    nadesLeft,
    "low",
    `Died holding unused nades ${nadesLeft} time${nadesLeft === 1 ? "" : "s"}`,
  );

  headlines.sort((a, b) => {
    const rank = { high: 0, mid: 1, low: 2 };
    return rank[a.severity] - rank[b.severity] || b.count - a.count;
  });
  notes.sort((a, b) => {
    const rank = { high: 0, mid: 1, low: 2 };
    return rank[a.severity] - rank[b.severity] || a.tick - b.tick;
  });

  return { headlines, notes };
}
