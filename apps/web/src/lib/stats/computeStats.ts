import { FULL_HEALTH, TRADE_SECONDS, tickRate } from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import type { Kill, PlayerStats, Replay, Round, Side } from "@/lib/replay/replayTypes";
import { currentSide } from "./liveScore";
import { inKnifeRound, isEnemy, isEnemyKill, isSuicide } from "./combat";
import { matchRating } from "./rating";

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
    headshot_percent: 0,
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
    rounds_ct: 0,
    rounds_t: 0,
    kills_ct: 0,
    kills_t: 0,
    deaths_ct: 0,
    deaths_t: 0,
    damage_ct: 0,
    damage_t: 0,
    adr_ct: 0,
    adr_t: 0,
    kills_per_round: 0,
    deaths_per_round: 0,
    rating_firepower: 0,
    rating_impact: 0,
    rating_support: 0,
    rating_clutch: 0,
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
    clutch_1v4: 0,
    clutch_1v5: 0,
    clutch_1v1_attempts: 0,
    clutch_1v2_attempts: 0,
    clutch_1v3_attempts: 0,
    clutch_1v4_attempts: 0,
    clutch_1v5_attempts: 0,
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

function applyMatchRating(s: PlayerStats): void {
  const r = Math.max(s.rounds, 1);
  s.kills_per_round = s.kills / r;
  s.deaths_per_round = s.deaths / r;
  const rated = matchRating(s);
  s.rating = rated.rating;
  s.rating_firepower = rated.firepower;
  s.rating_impact = rated.impact;
  s.rating_support = rated.support;
  s.rating_clutch = rated.clutch;
}

let statsCache: { replay: Replay; tick: number; stats: PlayerStats[] } | null = null;

export function computeStats(replay: Replay, untilTick: number): PlayerStats[] {
  const t = Math.floor(untilTick);
  if (statsCache && statsCache.replay === replay && statsCache.tick === t) {
    return statsCache.stats;
  }
  const n = replay.players.length;
  const stats = Array.from({ length: n }, (_, i) => empty(i));
  const tps = tickRate(replay);
  const tradeTicks = Math.round(TRADE_SECONDS * tps);

  const started = replay.rounds.filter(
    (r) => !r.is_knife && Math.min(r.freeze_end_tick, r.start_tick) <= untilTick,
  );
  for (const s of stats) {
    s.rounds = started.length;
  }

  for (const k of replay.kills) {
    if (k.tick > untilTick || inKnifeRound(replay, k.tick) || isSuicide(k)) {
      continue;
    }
    if (isEnemyKill(replay, k)) {
      stats[k.attacker].kills += 1;
      if (k.headshot) {
        stats[k.attacker].headshots += 1;
      }
      if (isHe(k.weapon)) {
        stats[k.attacker].he_kills += 1;
      }
      if (currentSide(replay, k.attacker, k.tick) === "CT") {
        stats[k.attacker].kills_ct += 1;
      } else {
        stats[k.attacker].kills_t += 1;
      }
    }
    if (k.victim >= 0 && k.victim < n) {
      stats[k.victim].deaths += 1;
      if (currentSide(replay, k.victim, k.tick) === "CT") {
        stats[k.victim].deaths_ct += 1;
      } else {
        stats[k.victim].deaths_t += 1;
      }
    }
    if (
      k.assister >= 0 &&
      k.assister < n &&
      k.victim >= 0 &&
      k.victim < n &&
      isEnemy(replay, k.assister, k.victim, k.tick)
    ) {
      stats[k.assister].assists += 1;
      if (k.assisted_flash) {
        stats[k.assister].flash_assists += 1;
      }
    }
  }

  applyDamage(replay, untilTick, stats);

  for (const b of replay.blinds ?? []) {
    if (b.tick > untilTick || inKnifeRound(replay, b.tick)) {
      continue;
    }
    if (
      b.attacker >= 0 &&
      b.victim >= 0 &&
      b.attacker !== b.victim &&
      b.attacker < n &&
      b.victim < n
    ) {
      if (currentSide(replay, b.attacker, b.tick) === currentSide(replay, b.victim, b.tick)) {
        continue;
      }
      stats[b.attacker].enemies_flashed += 1;
      stats[b.attacker].flash_time += b.duration;
    }
  }

  for (const g of replay.grenades) {
    if (g.start_tick > untilTick || inKnifeRound(replay, g.start_tick)) {
      continue;
    }
    if (g.thrower >= 0 && g.thrower < n) {
      stats[g.thrower].nades += 1;
    }
  }

  for (const e of replay.bombEvents) {
    if (e.tick > untilTick || inKnifeRound(replay, e.tick) || e.player < 0 || e.player >= n) {
      continue;
    }
    if (e.kind === "planted") {
      stats[e.player].plants += 1;
    }
    if (e.kind === "defused") {
      stats[e.player].defuses += 1;
    }
  }

  for (const round of started) {
    const end = Math.min(round.end_tick, untilTick);
    const roundKills = replay.kills.filter((k) => k.tick >= round.freeze_end_tick && k.tick <= end);
    const first = roundKills.find((k) => isEnemyKill(replay, k));
    if (first) {
      if (first.attacker >= 0 && first.attacker < n) {
        stats[first.attacker].first_kills += 1;
      }
      if (first.victim >= 0 && first.victim < n) {
        stats[first.victim].first_deaths += 1;
      }
    }

    const killsInRound = new Array(n).fill(0);
    const kast = new Array(n).fill(false);
    const diedAt: (number | null)[] = new Array(n).fill(null);
    const freeze = round.freeze_end_tick || round.start_tick;
    for (let i = 0; i < n; i++) {
      if (!presentAt(replay, i, freeze)) {
        continue;
      }
      if (currentSide(replay, i, freeze) === "CT") {
        stats[i].rounds_ct += 1;
      } else {
        stats[i].rounds_t += 1;
      }
    }

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
      if (k.victim >= 0 && k.victim < n && !isSuicide(k)) {
        diedAt[k.victim] = k.tick;
      }
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
      if (kast[i]) {
        stats[i].kast_rounds += 1;
      }
      if (killsInRound[i] === 2) {
        stats[i].multi_kills_2 += 1;
      } else if (killsInRound[i] === 3) {
        stats[i].multi_kills_3 += 1;
      } else if (killsInRound[i] === 4) {
        stats[i].multi_kills_4 += 1;
      } else if (killsInRound[i] >= 5) {
        stats[i].aces += 1;
      }
    }

    if (roundOver) {
      applyClutches(replay, round, roundKills, stats);
    }
  }

  for (const s of stats) {
    s.adr = s.rounds > 0 ? s.damage / s.rounds : 0;
    s.headshot_percent = s.kills > 0 ? (100 * s.headshots) / s.kills : 0;
    s.kast = s.rounds > 0 ? (100 * s.kast_rounds) / s.rounds : 0;
    s.kd = s.deaths > 0 ? s.kills / s.deaths : s.kills;
    s.entry_attempts = s.first_kills + s.first_deaths;
    s.entry_success = s.entry_attempts > 0 ? (100 * s.first_kills) / s.entry_attempts : 0;
    s.adr_ct = s.rounds_ct > 0 ? s.damage_ct / s.rounds_ct : 0;
    s.adr_t = s.rounds_t > 0 ? s.damage_t / s.rounds_t : 0;
    applyMatchRating(s);
  }
  statsCache = { replay, tick: t, stats };
  return stats;
}

function presentAt(replay: Replay, player: number, tick: number): boolean {
  const snap = samplePlayers(replay, tick);
  if (snap.length === 0) {
    return true;
  }
  return snap[player]?.present ?? false;
}

function applyDamage(replay: Replay, untilTick: number, stats: PlayerStats[]): void {
  const n = stats.length;
  const hurts = (replay.hurts ?? []).slice().sort((a, b) => a.tick - b.tick);
  const competitive = replay.rounds.filter((r) => !r.is_knife);
  for (const round of competitive) {
    if (round.start_tick > untilTick) {
      continue;
    }
    const end = Math.min(round.end_tick, untilTick);
    const hp = new Array(n).fill(FULL_HEALTH);
    for (const h of hurts) {
      if (h.tick < round.start_tick || h.tick > end) {
        continue;
      }
      if (h.victim < 0 || h.victim >= n || hp[h.victim] <= 0) {
        continue;
      }
      const dealt = Math.min(h.damage, hp[h.victim]);
      hp[h.victim] -= dealt;
      if (h.attacker < 0 || h.attacker >= n || h.attacker === h.victim) {
        continue;
      }
      if (currentSide(replay, h.attacker, h.tick) === currentSide(replay, h.victim, h.tick)) {
        continue;
      }
      stats[h.attacker].damage += dealt;
      if (currentSide(replay, h.attacker, h.tick) === "CT") {
        stats[h.attacker].damage_ct += dealt;
      } else {
        stats[h.attacker].damage_t += dealt;
      }
      if (isUtility(h.weapon)) {
        stats[h.attacker].utility_damage += dealt;
      }
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
    if (vicSide === currentSide(replay, death.attacker, death.tick)) {
      continue;
    }
    for (const k of roundKills) {
      if (k.tick <= death.tick || k.tick - death.tick > tradeTicks) {
        continue;
      }
      if (k.victim !== death.attacker || k.attacker < 0 || k.attacker >= n) {
        continue;
      }
      if (k.attacker === death.victim) {
        continue;
      }
      if (currentSide(replay, k.attacker, k.tick) !== vicSide) {
        continue;
      }
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
    if (!p.present) {
      continue;
    }
    side.set(p.index, p.ct ? "CT" : "T");
    if (p.alive) {
      alive.add(p.index);
    }
  }

  let clutchCt: { player: number; vs: number } | null = null;
  let clutchT: { player: number; vs: number } | null = null;

  const count = (want: Side) => {
    let c = 0;
    for (const i of alive) {
      if (side.get(i) === want) {
        c += 1;
      }
    }
    return c;
  };
  const lastAlive = (want: Side) => {
    for (const i of alive) {
      if (side.get(i) === want) {
        return i;
      }
    }
    return -1;
  };

  const note = () => {
    const ctN = count("CT");
    const tN = count("T");
    if (!clutchCt && ctN === 1 && tN >= 1) {
      const p = lastAlive("CT");
      if (p >= 0) {
        clutchCt = { player: p, vs: tN };
      }
    }
    if (!clutchT && tN === 1 && ctN >= 1) {
      const p = lastAlive("T");
      if (p >= 0) {
        clutchT = { player: p, vs: ctN };
      }
    }
  };

  note();
  for (const k of roundKills) {
    if (k.victim >= 0) {
      alive.delete(k.victim);
    }
    note();
  }

  const record = (c: { player: number; vs: number } | null, won: boolean) => {
    if (!c || c.player < 0 || c.player >= n) {
      return;
    }
    stats[c.player].clutch_attempts += 1;
    if (won) {
      stats[c.player].clutch_wins += 1;
    }
    const vs = Math.min(Math.max(c.vs, 1), 5);
    if (vs === 1) {
      stats[c.player].clutch_1v1_attempts += 1;
      if (won) stats[c.player].clutch_1v1 += 1;
    } else if (vs === 2) {
      stats[c.player].clutch_1v2_attempts += 1;
      if (won) stats[c.player].clutch_1v2 += 1;
    } else if (vs === 3) {
      stats[c.player].clutch_1v3_attempts += 1;
      if (won) stats[c.player].clutch_1v3 += 1;
    } else if (vs === 4) {
      stats[c.player].clutch_1v4_attempts += 1;
      if (won) stats[c.player].clutch_1v4 += 1;
    } else {
      stats[c.player].clutch_1v5_attempts += 1;
      if (won) stats[c.player].clutch_1v5 += 1;
    }
  };

  record(clutchCt, round.winner === "CT");
  record(clutchT, round.winner === "T");
}
