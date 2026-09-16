import type { Kill, Player, PlayerStats, Replay } from "@/lib/replay/replayTypes";
import { samplePlayer } from "@/lib/replay/sample";
import { prettyWeapon, refineHurtWeapon } from "@/lib/weapons/weapons";
import { inKnifeRound, isEnemyKill } from "./combat";
import { computeStats } from "./computeStats";
import type { SavedPlayerSnapshot } from "./scorecard";

export { inKnifeRound, isEnemy, isEnemyKill, isSuicide } from "./combat";
export { computeStats } from "./computeStats";
export { matchRating } from "./rating";
export { formatAdr, formatKast, exportStatsCsv } from "./format";
export {
  activeBomb,
  bombView,
  defuseClock,
  freezeRemaining,
  liveSituation,
  plantedBombPos,
  roundWinBanner,
  type BombView,
  type LiveSituation,
} from "./hud";
export {
  currentSide,
  liveScore,
  liveScoreboardPlayers,
  liveTeams,
  onLiveScoreboard,
  type LiveTeams,
} from "./liveScore";
export {
  formatScorecard,
  matchEndTick,
  matchScorecard,
  roundSidesSwapped,
  type MatchHalfScore,
  type MatchScorecard,
  type SavedPlayerSnapshot,
} from "./scorecard";

/** Share of opening duels among players who started on the same side (0–100). */
export function teamEntryShare(
  stats: PlayerStats[],
  players: Player[],
  player: number,
): { attempts: number; teamAttempts: number; pct: number } {
  const side = players[player]?.start_side;
  const mine = stats[player]?.entry_attempts ?? 0;
  let teamAttempts = 0;
  for (const s of stats) {
    if (players[s.player]?.start_side === side) {
      teamAttempts += s.entry_attempts;
    }
  }
  return {
    attempts: mine,
    teamAttempts,
    pct: teamAttempts > 0 ? (100 * mine) / teamAttempts : 0,
  };
}

/** Compact end-of-match rows for a saved-note hover. Not the live scoreboard. */
export function savedPlayerSnapshots(replay: Replay, tick: number): SavedPlayerSnapshot[] {
  return computeStats(replay, tick).map((s) => {
    const p = replay.players[s.player];
    return {
      name: p?.name ?? "?",
      start_side: p?.start_side ?? "CT",
      kills: s.kills,
      deaths: s.deaths,
      adr: s.adr,
      kast: s.kast,
      rating: Math.round(s.rating * 100) / 100,
    };
  });
}

export interface WeaponRow {
  weapon: string;
  raw: string;
  kills: number;
  headshots: number;
  damage: number;
}

let weaponCache: {
  replay: Replay;
  tick: number;
  player: number | null;
  rows: WeaponRow[];
} | null = null;

/** Cached per `(replay, tick, player)`: this scans every kill and every hurt. */
export function weaponBreakdown(
  replay: Replay,
  untilTick: number,
  player: number | null,
): WeaponRow[] {
  const t = Math.floor(untilTick);
  if (
    weaponCache &&
    weaponCache.replay === replay &&
    weaponCache.tick === t &&
    weaponCache.player === player
  ) {
    return weaponCache.rows;
  }
  const rows = computeWeaponBreakdown(replay, untilTick, player);
  weaponCache = { replay, tick: t, player, rows };
  return rows;
}

function computeWeaponBreakdown(
  replay: Replay,
  untilTick: number,
  player: number | null,
): WeaponRow[] {
  const by = new Map<string, WeaponRow>();
  const add = (weapon: string) => {
    const key = prettyWeapon(weapon);
    let row = by.get(key);
    if (!row) {
      row = { weapon: key, raw: weapon, kills: 0, headshots: 0, damage: 0 };
      by.set(key, row);
    }
    return row;
  };
  for (const k of replay.kills) {
    if (k.tick > untilTick || inKnifeRound(replay, k.tick) || !isEnemyKill(replay, k)) {
      continue;
    }
    if (player != null && k.attacker !== player) {
      continue;
    }
    const row = add(k.weapon);
    row.kills += 1;
    if (k.headshot) {
      row.headshots += 1;
    }
  }
  for (const h of replay.hurts ?? []) {
    if (h.tick > untilTick || inKnifeRound(replay, h.tick)) {
      continue;
    }
    if (player != null && h.attacker !== player) {
      continue;
    }
    if (h.attacker < 0) {
      continue;
    }
    const held = samplePlayer(replay, h.attacker, h.tick);
    add(
      refineHurtWeapon(h.weapon, held?.active ?? 0, held?.primary ?? 0, held?.secondary ?? 0),
    ).damage += h.damage;
  }
  return [...by.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage);
}

export function recentKills(replay: Replay, tick: number, windowTicks: number, limit = 8): Kill[] {
  const from = tick - windowTicks;
  const out: Kill[] = [];
  for (let i = replay.kills.length - 1; i >= 0; i--) {
    const k = replay.kills[i];
    if (k.tick > tick) {
      continue;
    }
    if (k.tick < from) {
      break;
    }
    out.push(k);
    if (out.length >= limit) {
      break;
    }
  }
  return out.reverse();
}

export function nextEventTick(ticks: number[], tick: number, dir: 1 | -1): number | null {
  if (dir > 0) {
    const t = ticks.find((x) => x > tick + 0.5);
    return t ?? null;
  }
  for (let i = ticks.length - 1; i >= 0; i--) {
    if (ticks[i] < tick - 0.5) {
      return ticks[i];
    }
  }
  return null;
}
