import {
  ECO_MAX_EQUIPMENT,
  MIN_REVIEW_FLASH_SECONDS,
  TRADE_SECONDS,
  tickRate,
} from "@/lib/shared/constants";
import { isPistolRoundNumber } from "@/lib/parse/roundTags";
import { samplePlayers } from "@/lib/replay/sample";
import { currentSide, isEnemyKill } from "@/lib/stats/stats";
import type { Kill, Replay, Round } from "@/lib/replay/replayTypes";
import {
  GEAR_DECOY,
  GEAR_FLASH,
  GEAR_FLASH2,
  GEAR_HE,
  GEAR_MOLLY,
  GEAR_SMOKE,
} from "@/lib/replay/replayTypes";
import { prettyWeapon } from "@/lib/weapons/weapons";

const NADE_GEAR = GEAR_HE | GEAR_FLASH | GEAR_FLASH2 | GEAR_SMOKE | GEAR_MOLLY | GEAR_DECOY;

export type ReviewSeverity = "good" | "high" | "mid" | "low";

export type ReviewKind = "opening" | "clutch" | "death" | "multi" | "eco";

export interface ReviewHeadline {
  text: string;
  severity: ReviewSeverity;
  count: number;
  kind: ReviewKind;
}

export interface ReviewNote {
  tick: number;
  roundLabel: string;
  title: string;
  detail: string;
  severity: ReviewSeverity;
  kind: ReviewKind;
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
  const tps = tickRate(replay);
  let hit: { by: number; duration: number } | null = null;
  for (const b of replay.blinds ?? []) {
    if (b.victim !== player || b.duration < MIN_REVIEW_FLASH_SECONDS) continue;
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
  const tps = tickRate(replay);
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

/** Largest 1vX the player was in this round, or 0 if they were never last alive. */
function clutchVs(
  replay: Replay,
  round: Round,
  roundKills: Kill[],
  player: number,
  side: "T" | "CT",
): number {
  const snap = samplePlayers(replay, round.freeze_end_tick || round.start_tick);
  if (snap.length === 0) return 0;
  const alive = new Set<number>();
  const sides = new Map<number, "T" | "CT">();
  for (const p of snap) {
    if (!p.present || !p.alive) continue;
    alive.add(p.index);
    sides.set(p.index, p.ct ? "CT" : "T");
  }
  let maxVs = 0;
  const count = (want: "T" | "CT") => {
    let n = 0;
    for (const i of alive) if (sides.get(i) === want) n += 1;
    return n;
  };
  const note = () => {
    if (!alive.has(player) || sides.get(player) !== side) return;
    const us = count(side);
    const them = count(side === "CT" ? "T" : "CT");
    if (us === 1 && them >= 1) maxVs = Math.max(maxVs, them);
  };
  note();
  for (const k of roundKills) {
    if (k.victim >= 0) alive.delete(k.victim);
    note();
  }
  return maxVs;
}

export function playerReview(replay: Replay, player: number, untilTick: number): PlayerReview {
  const notes: ReviewNote[] = [];
  const name = (i: number) => (i < 0 ? "World" : (replay.players[i]?.name ?? "?"));
  let opening = 0;
  let openingWin = 0;
  let openingLoss = 0;
  let untraded = 0;
  let flashed = 0;
  let utilDeaths = 0;
  let clutchLoss = 0;
  let clutchWin = 0;
  let fedMulti = 0;
  let noReturn = 0;
  let nadesLeft = 0;
  let multi = 0;
  let ecoWins = 0;
  let tradedOpeners = 0;

  for (const r of replay.rounds) {
    if (r.is_knife) continue;
    const end = Math.min(r.end_tick, untilTick);
    if (r.freeze_end_tick > untilTick) continue;
    const roundKills = replay.kills.filter((k) => k.tick >= r.freeze_end_tick && k.tick <= end);
    const first = roundKills.find((k) => isEnemyKill(replay, k));
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

      const wasTraded = k.attacker >= 0 && traded(replay, k, untilTick);
      if (k.attacker >= 0 && !wasTraded) {
        untraded += 1;
        bits.push("untraded");
        if (severity !== "high") severity = "mid";
      } else if (openingDeath && wasTraded) {
        bits.push("traded");
        if (severity === "high") severity = "mid";
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

      const clutchDeath = teammates === 0 && enemies >= 1;
      const title = openingDeath
        ? `Lost the opening to ${killer}`
        : clutchDeath
          ? `Lost a 1v${enemies} to ${killer}`
          : `Died to ${killer}`;

      notes.push({
        tick: k.tick,
        roundLabel: roundLabel(r),
        title,
        detail: [gun + (k.headshot ? " HS" : ""), ...bits].join(" · "),
        severity,
        kind: openingDeath ? "opening" : clutchDeath ? "clutch" : "death",
      });
    }

    if (first && first.attacker === player && r.end_tick <= untilTick) {
      openingWin += 1;
      notes.push({
        tick: first.tick,
        roundLabel: roundLabel(r),
        title: `Won the opening vs ${name(first.victim)}`,
        detail: prettyWeapon(first.weapon) + (first.headshot ? " HS" : ""),
        severity: "good",
        kind: "opening",
      });
    } else if (
      first &&
      first.attacker !== player &&
      first.victim !== player &&
      r.end_tick <= untilTick
    ) {
      const tps = tickRate(replay);
      const window = Math.round(TRADE_SECONDS * tps);
      const trade = roundKills.find(
        (k) =>
          isEnemyKill(replay, k) &&
          k.attacker === player &&
          k.victim === first.attacker &&
          k.tick > first.tick &&
          k.tick <= first.tick + window,
      );
      if (trade) {
        tradedOpeners += 1;
        notes.push({
          tick: trade.tick,
          roundLabel: roundLabel(r),
          title: `Traded the opener (${name(first.victim)})`,
          detail: prettyWeapon(trade.weapon) + (trade.headshot ? " HS" : ""),
          severity: "good",
          kind: "opening",
        });
      }
    }

    const myFrags = roundKills.filter((k) => isEnemyKill(replay, k) && k.attacker === player);
    if (myFrags.length >= 4) {
      multi += 1;
      const last = myFrags[myFrags.length - 1];
      notes.push({
        tick: last.tick,
        roundLabel: roundLabel(r),
        title: myFrags.length >= 5 ? "Ace" : `${myFrags.length}k this round`,
        detail: myFrags.map((k) => prettyWeapon(k.weapon)).join(", "),
        severity: "good",
        kind: "multi",
      });
    }

    const freeze = r.freeze_end_tick || r.start_tick;
    const me = samplePlayers(replay, freeze).find((p) => p.index === player);
    if (
      !isPistolRoundNumber(r.number) &&
      me &&
      me.equip < ECO_MAX_EQUIPMENT &&
      r.end_tick <= untilTick &&
      r.winner === side
    ) {
      ecoWins += 1;
      notes.push({
        tick: freeze,
        roundLabel: roundLabel(r),
        title: "Won the round on an eco",
        detail: `eq $${me.equip}`,
        severity: "good",
        kind: "eco",
      });
    }

    if (r.end_tick <= untilTick && r.winner === side) {
      const vs = clutchVs(replay, r, roundKills, player, side);
      if (vs >= 1) {
        clutchWin += 1;
        const last = [...roundKills].reverse().find((k) => k.attacker === player);
        notes.push({
          tick: last?.tick ?? (r.freeze_end_tick || r.start_tick),
          roundLabel: roundLabel(r),
          title: `Won a 1v${vs}`,
          detail: "clutch",
          severity: "good",
          kind: "clutch",
        });
      }
    }
  }

  const headlines: ReviewHeadline[] = [];
  const push = (count: number, severity: ReviewSeverity, kind: ReviewKind, text: string) => {
    if (count > 0) headlines.push({ count, severity, kind, text });
  };
  push(
    openingWin,
    "good",
    "opening",
    `Won ${openingWin} opening duel${openingWin === 1 ? "" : "s"}`,
  );
  push(clutchWin, "good", "clutch", `Won ${clutchWin} clutch${clutchWin === 1 ? "" : "es"}`);
  push(
    tradedOpeners,
    "good",
    "opening",
    `Traded ${tradedOpeners} opener${tradedOpeners === 1 ? "" : "s"}`,
  );
  push(multi, "good", "multi", `${multi} round${multi === 1 ? "" : "s"} with 4k+`);
  push(ecoWins, "good", "eco", `Won ${ecoWins} eco round${ecoWins === 1 ? "" : "s"}`);
  push(
    opening,
    "high",
    "opening",
    openingLoss
      ? `Lost ${opening} opening duel${opening === 1 ? "" : "s"} (${openingLoss} in rounds the team lost)`
      : `Lost ${opening} opening duel${opening === 1 ? "" : "s"}`,
  );
  push(flashed, "high", "death", `Died flashed ${flashed} time${flashed === 1 ? "" : "s"}`);
  push(clutchLoss, "high", "clutch", `Lost ${clutchLoss} clutch${clutchLoss === 1 ? "" : "es"}`);
  push(untraded, "mid", "death", `${untraded} untraded death${untraded === 1 ? "" : "s"}`);
  push(
    noReturn,
    "mid",
    "death",
    `${noReturn} gunfight${noReturn === 1 ? "" : "s"} with almost no damage back`,
  );
  push(fedMulti, "mid", "death", `Fed ${fedMulti} multi-kill${fedMulti === 1 ? "" : "s"}`);
  push(
    utilDeaths,
    "mid",
    "death",
    `Died to utility ${utilDeaths} time${utilDeaths === 1 ? "" : "s"}`,
  );
  push(
    nadesLeft,
    "low",
    "death",
    `Died holding unused nades ${nadesLeft} time${nadesLeft === 1 ? "" : "s"}`,
  );

  headlines.sort((a, b) => {
    const rank = { good: 0, high: 1, mid: 2, low: 3 };
    return rank[a.severity] - rank[b.severity] || b.count - a.count;
  });
  notes.sort((a, b) => {
    const rank = { good: 0, high: 1, mid: 2, low: 3 };
    return rank[a.severity] - rank[b.severity] || a.tick - b.tick;
  });

  return { headlines, notes };
}
