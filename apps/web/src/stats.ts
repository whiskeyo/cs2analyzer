import { currentRound, samplePlayers } from "./sample";
import type { Kill, PlayerStats, Replay, Round, Side } from "./types";
import { prettyWeapon } from "./weapons";

const TRADE_SECONDS = 5;
const BOMB_SECONDS = 40;

function empty(player: number): PlayerStats {
  return {
    player,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshots: 0,
    damage: 0,
    utility_damage: 0,
    enemies_flashed: 0,
    first_kills: 0,
    first_deaths: 0,
    kast_rounds: 0,
    rounds: 0,
    adr: 0,
    hs_percent: 0,
    kast: 0,
    kd: 0,
    multi_kills_2: 0,
    multi_kills_3: 0,
    multi_kills_4: 0,
    aces: 0,
    flash_assists: 0,
    plants: 0,
    defuses: 0,
    trade_kills: 0,
    trade_deaths: 0,
    entry_attempts: 0,
    entry_success: 0,
    kpr: 0,
    dpr: 0,
    impact: 0,
    rating: 0,
    flash_time: 0,
    nades: 0,
    he_kills: 0,
    survived: 0,
    clutch_attempts: 0,
    clutch_wins: 0,
    clutch_1v1: 0,
    clutch_1v2: 0,
    clutch_1v3: 0,
    damage_taken: 0,
  };
}

function isUtility(weapon: string): boolean {
  const w = weapon.toLowerCase();
  return (
    w.includes("hegrenade") ||
    w.includes("inferno") ||
    w.includes("molotov") ||
    w.includes("incgrenade")
  );
}

function isHe(weapon: string): boolean {
  return weapon.toLowerCase().includes("hegrenade");
}

export function inKnifeRound(replay: Replay, tick: number): boolean {
  const r = replay.rounds.find((x) => tick >= x.start_tick && tick <= x.end_tick);
  return r?.is_knife ?? false;
}

export function isSuicide(k: Kill): boolean {
  return k.attacker >= 0 && k.attacker === k.victim;
}

export function isEnemy(replay: Replay, a: number, b: number, tick: number): boolean {
  return a !== b && currentSide(replay, a, tick) !== currentSide(replay, b, tick);
}

export function isEnemyKill(replay: Replay, k: Kill): boolean {
  return k.attacker >= 0 && k.victim >= 0 && isEnemy(replay, k.attacker, k.victim, k.tick);
}

export function roundSidesSwapped(replay: Replay, round: Round): boolean {
  const tick = round.freeze_end_tick || round.start_tick;
  const snap = samplePlayers(replay, tick);
  const present = snap.filter((p) => p.present);
  if (present.length === 0) return swappedBySchedule(round.number);
  let flipped = 0;
  for (const p of present) {
    const startedCt = replay.players[p.index]?.start_side === "CT";
    if (p.ct !== startedCt) flipped += 1;
  }
  return flipped * 2 > present.length;
}

function swappedBySchedule(number: number): boolean {
  if (number <= 0 || number <= 12) return false;
  if (number <= 24) return true;
  return Math.floor((number - 25) / 3) % 2 === 1;
}

function winnerStartingSide(replay: Replay, round: Round): Side | null {
  if (!round.winner) return null;
  return roundSidesSwapped(replay, round) ? flipSide(round.winner) : round.winner;
}

function flipSide(side: Side): Side {
  return side === "CT" ? "T" : "CT";
}

/** Match wins for whoever is currently on CT / T at `tick`. */
export function liveScore(replay: Replay, tick: number): { ct: number; t: number } {
  let startCt = 0;
  let startT = 0;
  for (const r of replay.rounds) {
    if (r.is_knife || r.end_tick > tick) continue;
    const start = winnerStartingSide(replay, r);
    if (start === "CT") startCt += 1;
    else if (start === "T") startT += 1;
  }
  const round = currentRound(replay, tick);
  const swapped = round ? roundSidesSwapped(replay, round) : false;
  return swapped ? { ct: startT, t: startCt } : { ct: startCt, t: startT };
}

/** Team names and scores for the sides currently playing CT / T. */
export function liveTeams(
  replay: Replay,
  tick: number,
): {
  ct: number;
  t: number;
  ctName: string;
  tName: string;
} {
  const score = liveScore(replay, tick);
  const round = currentRound(replay, tick);
  const swapped = round ? roundSidesSwapped(replay, round) : false;
  const ctName =
    round?.team_ct || (swapped ? replay.header.team_t || "T" : replay.header.team_ct || "CT");
  const tName =
    round?.team_t || (swapped ? replay.header.team_ct || "CT" : replay.header.team_t || "T");
  return { ...score, ctName, tName };
}

function hltvRating(s: PlayerStats): void {
  const r = s.rounds || 1;
  s.kpr = s.kills / r;
  s.dpr = s.deaths / r;
  const apr = s.assists / r;
  s.impact = 2.13 * s.kpr + 0.42 * apr - 0.41;
  s.rating =
    0.0073 * s.kast +
    0.3591 * s.kpr +
    -0.5329 * s.dpr +
    0.2372 * s.impact +
    0.0032 * s.adr +
    0.1587;
}

let statsCache: { replay: Replay; tick: number; stats: PlayerStats[] } | null = null;

export function computeStats(replay: Replay, untilTick: number): PlayerStats[] {
  const t = Math.floor(untilTick);
  if (statsCache && statsCache.replay === replay && statsCache.tick === t) {
    return statsCache.stats;
  }
  const n = replay.players.length;
  const stats = Array.from({ length: n }, (_, i) => empty(i));
  const tps = replay.header.tick_rate || 64;
  const tradeTicks = Math.round(TRADE_SECONDS * tps);

  const started = replay.rounds.filter(
    (r) => !r.is_knife && Math.min(r.freeze_end_tick, r.start_tick) <= untilTick,
  );
  for (const s of stats) s.rounds = started.length;

  for (const k of replay.kills) {
    if (k.tick > untilTick || inKnifeRound(replay, k.tick) || isSuicide(k)) continue;
    if (isEnemyKill(replay, k)) {
      stats[k.attacker].kills += 1;
      if (k.headshot) stats[k.attacker].headshots += 1;
      if (isHe(k.weapon)) stats[k.attacker].he_kills += 1;
    }
    if (k.victim >= 0 && k.victim < n) stats[k.victim].deaths += 1;
    if (
      k.assister >= 0 &&
      k.assister < n &&
      k.victim >= 0 &&
      k.victim < n &&
      isEnemy(replay, k.assister, k.victim, k.tick)
    ) {
      stats[k.assister].assists += 1;
      if (k.assisted_flash) stats[k.assister].flash_assists += 1;
    }
  }

  applyDamage(replay, untilTick, stats);

  for (const b of replay.blinds ?? []) {
    if (b.tick > untilTick || inKnifeRound(replay, b.tick)) continue;
    if (
      b.attacker >= 0 &&
      b.victim >= 0 &&
      b.attacker !== b.victim &&
      b.attacker < n &&
      b.victim < n
    ) {
      if (currentSide(replay, b.attacker, b.tick) === currentSide(replay, b.victim, b.tick))
        continue;
      stats[b.attacker].enemies_flashed += 1;
      stats[b.attacker].flash_time += b.duration;
    }
  }

  for (const g of replay.grenades) {
    if (g.start_tick > untilTick || inKnifeRound(replay, g.start_tick)) continue;
    if (g.thrower >= 0 && g.thrower < n) stats[g.thrower].nades += 1;
  }

  for (const e of replay.bombEvents) {
    if (e.tick > untilTick || inKnifeRound(replay, e.tick) || e.player < 0 || e.player >= n) {
      continue;
    }
    if (e.kind === "planted") stats[e.player].plants += 1;
    if (e.kind === "defused") stats[e.player].defuses += 1;
  }

  for (const round of started) {
    const end = Math.min(round.end_tick, untilTick);
    const roundKills = replay.kills.filter((k) => k.tick >= round.freeze_end_tick && k.tick <= end);
    const first = roundKills.find((k) => isEnemyKill(replay, k));
    if (first) {
      if (first.attacker >= 0 && first.attacker < n) stats[first.attacker].first_kills += 1;
      if (first.victim >= 0 && first.victim < n) stats[first.victim].first_deaths += 1;
    }

    const killsInRound = new Array(n).fill(0);
    const kast = new Array(n).fill(false);
    const diedAt: (number | null)[] = new Array(n).fill(null);
    const freeze = round.freeze_end_tick || round.start_tick;

    for (const k of roundKills) {
      if (isEnemyKill(replay, k) && k.attacker < n) {
        kast[k.attacker] = true;
        killsInRound[k.attacker] += 1;
      }
      if (
        k.assister >= 0 &&
        k.assister < n &&
        k.victim >= 0 &&
        k.victim < n &&
        isEnemy(replay, k.assister, k.victim, k.tick)
      ) {
        kast[k.assister] = true;
      }
      if (k.victim >= 0 && k.victim < n && !isSuicide(k)) diedAt[k.victim] = k.tick;
    }

    const roundOver = round.end_tick <= untilTick;
    for (let i = 0; i < n; i++) {
      if (diedAt[i] == null && roundOver && presentAt(replay, i, freeze)) {
        kast[i] = true;
        stats[i].survived += 1;
      }
    }

    applyTrades(replay, roundKills, tradeTicks, kast, stats);

    for (let i = 0; i < n; i++) {
      if (kast[i]) stats[i].kast_rounds += 1;
      if (killsInRound[i] === 2) stats[i].multi_kills_2 += 1;
      else if (killsInRound[i] === 3) stats[i].multi_kills_3 += 1;
      else if (killsInRound[i] === 4) stats[i].multi_kills_4 += 1;
      else if (killsInRound[i] >= 5) stats[i].aces += 1;
    }

    if (roundOver) applyClutches(replay, round, roundKills, stats);
  }

  for (const s of stats) {
    s.adr = s.rounds > 0 ? s.damage / s.rounds : 0;
    s.hs_percent = s.kills > 0 ? (100 * s.headshots) / s.kills : 0;
    s.kast = s.rounds > 0 ? (100 * s.kast_rounds) / s.rounds : 0;
    s.kd = s.deaths > 0 ? s.kills / s.deaths : s.kills;
    s.entry_attempts = s.first_kills + s.first_deaths;
    s.entry_success = s.entry_attempts > 0 ? (100 * s.first_kills) / s.entry_attempts : 0;
    hltvRating(s);
  }
  statsCache = { replay, tick: t, stats };
  return stats;
}

function presentAt(replay: Replay, player: number, tick: number): boolean {
  const snap = samplePlayers(replay, tick);
  if (snap.length === 0) return true;
  return snap[player]?.present ?? false;
}

function applyDamage(replay: Replay, untilTick: number, stats: PlayerStats[]): void {
  const n = stats.length;
  const hurts = (replay.hurts ?? []).slice().sort((a, b) => a.tick - b.tick);
  const competitive = replay.rounds.filter((r) => !r.is_knife);
  for (const round of competitive) {
    if (round.start_tick > untilTick) continue;
    const end = Math.min(round.end_tick, untilTick);
    const hp = new Array(n).fill(100);
    for (const h of hurts) {
      if (h.tick < round.start_tick || h.tick > end) continue;
      if (h.victim < 0 || h.victim >= n || hp[h.victim] <= 0) continue;
      const dealt = Math.min(h.damage, hp[h.victim]);
      hp[h.victim] -= dealt;
      if (h.attacker < 0 || h.attacker >= n || h.attacker === h.victim) continue;
      if (currentSide(replay, h.attacker, h.tick) === currentSide(replay, h.victim, h.tick)) {
        continue;
      }
      stats[h.attacker].damage += dealt;
      if (isUtility(h.weapon)) stats[h.attacker].utility_damage += dealt;
      stats[h.victim].damage_taken += dealt;
    }
  }
}

function applyTrades(
  replay: Replay,
  roundKills: Kill[],
  tradeTicks: number,
  kast: boolean[],
  stats: PlayerStats[],
): void {
  const n = stats.length;
  for (const death of roundKills) {
    if (death.victim < 0 || death.attacker < 0 || death.victim >= n || death.attacker >= n) {
      continue;
    }
    const vicSide = currentSide(replay, death.victim, death.tick);
    if (vicSide === currentSide(replay, death.attacker, death.tick)) continue;
    for (const k of roundKills) {
      if (k.tick <= death.tick || k.tick - death.tick > tradeTicks) continue;
      if (k.victim !== death.attacker || k.attacker < 0 || k.attacker >= n) continue;
      if (k.attacker === death.victim) continue;
      if (currentSide(replay, k.attacker, k.tick) !== vicSide) continue;
      kast[death.victim] = true;
      stats[k.attacker].trade_kills += 1;
      stats[death.victim].trade_deaths += 1;
      break;
    }
  }
}

function applyClutches(
  replay: Replay,
  round: Round,
  roundKills: Kill[],
  stats: PlayerStats[],
): void {
  const n = replay.players.length;
  const snap = samplePlayers(replay, round.freeze_end_tick || round.start_tick);
  const alive = new Set<number>();
  const side = new Map<number, Side>();
  for (const p of snap) {
    if (!p.present) continue;
    side.set(p.index, p.ct ? "CT" : "T");
    if (p.alive) alive.add(p.index);
  }

  let clutchCt: { player: number; vs: number } | null = null;
  let clutchT: { player: number; vs: number } | null = null;

  const count = (want: Side) => {
    let c = 0;
    for (const i of alive) if (side.get(i) === want) c += 1;
    return c;
  };
  const lastAlive = (want: Side) => {
    for (const i of alive) if (side.get(i) === want) return i;
    return -1;
  };

  const note = () => {
    const ctN = count("CT");
    const tN = count("T");
    if (!clutchCt && ctN === 1 && tN >= 1) {
      const p = lastAlive("CT");
      if (p >= 0) clutchCt = { player: p, vs: tN };
    }
    if (!clutchT && tN === 1 && ctN >= 1) {
      const p = lastAlive("T");
      if (p >= 0) clutchT = { player: p, vs: ctN };
    }
  };

  note();
  for (const k of roundKills) {
    if (k.victim >= 0) alive.delete(k.victim);
    note();
  }

  const record = (c: { player: number; vs: number } | null, won: boolean) => {
    if (!c || c.player < 0 || c.player >= n) return;
    stats[c.player].clutch_attempts += 1;
    if (c.vs === 1) stats[c.player].clutch_1v1 += won ? 1 : 0;
    else if (c.vs === 2) stats[c.player].clutch_1v2 += won ? 1 : 0;
    else if (c.vs >= 3 && won) stats[c.player].clutch_1v3 += 1;
    if (won) stats[c.player].clutch_wins += 1;
  };

  record(clutchCt, round.winner === "CT");
  record(clutchT, round.winner === "T");
}

export function currentSide(replay: Replay, player: number, tick: number): Side {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player >= pc) return replay.players[player]?.start_side ?? "T";
  let lo = 0;
  let hi = buf.ticks.length - 1;
  const t = Math.floor(tick);
  if (buf.ticks.length === 0) return replay.players[player]?.start_side ?? "T";
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (buf.ticks[mid] <= t) lo = mid;
    else hi = mid;
  }
  const flags = buf.flags[lo * pc + player];
  if ((flags & 1) === 0) return replay.players[player]?.start_side ?? "T";
  return flags & (1 << 4) ? "CT" : "T";
}

export interface LiveSituation {
  ctAlive: number;
  tAlive: number;
  clutch: { player: number; vs: number; side: Side } | null;
  bomb: { remaining: number; planted: boolean } | null;
}

export function liveSituation(replay: Replay, tick: number): LiveSituation {
  const players = samplePlayers(replay, tick);
  const ctAlive = players.filter((p) => p.present && p.alive && p.ct).length;
  const tAlive = players.filter((p) => p.present && p.alive && !p.ct).length;
  let clutch: LiveSituation["clutch"] = null;
  if (ctAlive === 1 && tAlive >= 1) {
    const p = players.find((x) => x.present && x.alive && x.ct);
    if (p) clutch = { player: p.index, vs: tAlive, side: "CT" };
  } else if (tAlive === 1 && ctAlive >= 1) {
    const p = players.find((x) => x.present && x.alive && !x.ct);
    if (p) clutch = { player: p.index, vs: ctAlive, side: "T" };
  }

  const bomb = bombClock(replay, tick, ctAlive, players.filter((p) => p.present && p.ct).length);

  return { ctAlive, tAlive, clutch, bomb };
}

/** Planted C4 while it is still in play. Stops on defuse/explode, 40s, round over, or CT wipe. */
export function activeBomb(
  replay: Replay,
  tick: number,
): { remaining: number; planted: boolean; x: number; y: number } | null {
  const players = samplePlayers(replay, tick);
  const ct = players.filter((p) => p.present && p.ct);
  const clock = bombClock(replay, tick, ct.filter((p) => p.alive).length, ct.length);
  if (!clock) return null;
  const round = currentRound(replay, tick);
  if (!round) return null;
  let plant: { x: number; y: number } | null = null;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) continue;
    if (e.tick < round.start_tick || e.tick > round.end_tick) continue;
    if (e.kind === "planted") plant = { x: e.x, y: e.y };
    if (e.kind === "defused" || e.kind === "exploded") plant = null;
  }
  if (!plant) return null;
  return { ...clock, ...plant };
}

function bombClock(
  replay: Replay,
  tick: number,
  ctAlive: number,
  ctPresent: number,
): { remaining: number; planted: boolean } | null {
  const tps = replay.header.tick_rate || 64;
  const round = currentRound(replay, tick);
  if (!round || tick > round.end_tick) return null;
  const next = replay.rounds.find((r) => r.start_tick > round.start_tick);
  if (next && tick >= next.start_tick) return null;

  let plantTick = -1;
  for (const e of replay.bombEvents) {
    if (e.tick > tick) continue;
    if (e.tick < round.start_tick || e.tick > round.end_tick) continue;
    if (e.kind === "planted") plantTick = e.tick;
    if ((e.kind === "defused" || e.kind === "exploded") && e.tick >= plantTick) plantTick = -1;
  }
  // CS2: bomb clock is gone as soon as CTs are eliminated (T already won).
  if (ctPresent > 0 && ctAlive === 0) plantTick = -1;
  if (plantTick < 0) return null;
  const remaining = BOMB_SECONDS - (tick - plantTick) / tps;
  if (remaining <= 0) return null;
  return { remaining, planted: true };
}

export interface WeaponRow {
  weapon: string;
  raw: string;
  kills: number;
  hs: number;
  damage: number;
}

export function weaponBreakdown(
  replay: Replay,
  untilTick: number,
  player: number | null,
): WeaponRow[] {
  const by = new Map<string, WeaponRow>();
  const add = (weapon: string) => {
    const key = prettyWeapon(weapon);
    let row = by.get(key);
    if (!row) {
      row = { weapon: key, raw: weapon, kills: 0, hs: 0, damage: 0 };
      by.set(key, row);
    }
    return row;
  };
  for (const k of replay.kills) {
    if (k.tick > untilTick || inKnifeRound(replay, k.tick) || !isEnemyKill(replay, k)) continue;
    if (player != null && k.attacker !== player) continue;
    const row = add(k.weapon);
    row.kills += 1;
    if (k.headshot) row.hs += 1;
  }
  for (const h of replay.hurts ?? []) {
    if (h.tick > untilTick || inKnifeRound(replay, h.tick)) continue;
    if (player != null && h.attacker !== player) continue;
    if (h.attacker < 0) continue;
    add(h.weapon).damage += h.damage;
  }
  return [...by.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage);
}

export function recentKills(replay: Replay, tick: number, windowTicks: number, limit = 8): Kill[] {
  const from = tick - windowTicks;
  const out: Kill[] = [];
  for (let i = replay.kills.length - 1; i >= 0; i--) {
    const k = replay.kills[i];
    if (k.tick > tick) continue;
    if (k.tick < from) break;
    out.push(k);
    if (out.length >= limit) break;
  }
  return out.reverse();
}

export function nextEventTick(ticks: number[], tick: number, dir: 1 | -1): number | null {
  if (dir > 0) {
    const t = ticks.find((x) => x > tick + 0.5);
    return t ?? null;
  }
  for (let i = ticks.length - 1; i >= 0; i--) {
    if (ticks[i] < tick - 0.5) return ticks[i];
  }
  return null;
}

export function exportStatsCsv(replay: Replay, stats: PlayerStats[], tick: number): string {
  const headers = [
    "Player",
    "Steam64",
    "K",
    "D",
    "A",
    "ADR",
    "KAST",
    "HS%",
    "Rating",
    "FK",
    "FD",
    "Trades",
    "UD",
    "Flashes",
    "Nades",
    "Clutch W/A",
    "Plants",
    "Defuses",
  ];
  const rows = stats.map((s) => {
    const p = replay.players[s.player];
    return [
      p?.name ?? "?",
      p?.steam_id ?? "",
      s.kills,
      s.deaths,
      s.assists,
      s.adr.toFixed(1),
      s.kast.toFixed(1),
      s.hs_percent.toFixed(1),
      s.rating.toFixed(2),
      s.first_kills,
      s.first_deaths,
      s.trade_kills,
      s.utility_damage,
      s.enemies_flashed,
      s.nades,
      `${s.clutch_wins}/${s.clutch_attempts}`,
      s.plants,
      s.defuses,
    ].join(",");
  });
  return [`# ${replay.header.map_name} tick ${Math.floor(tick)}`, headers.join(","), ...rows].join(
    "\n",
  );
}
