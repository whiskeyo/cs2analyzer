/**
 * Builders for synthetic `Replay` data used by tests.
 *
 * Every builder takes overrides so a test only states the fields it asserts on.
 * Keep these tiny and synthetic: tests must never read `.demos/*.dem`.
 */

import { DEFAULT_TICK_RATE, FULL_HEALTH } from "@/lib/shared/constants";
import { LAYOUT_SCHEMA, type LayoutCallout, type MapLayout } from "@/lib/radar/layouts";
import type { MapPlaces } from "@/lib/match/sites";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_PRESENT,
  type Blind,
  type BombEvent,
  type GrenadeThrow,
  type Hurt,
  type Kill,
  type MapCalibration,
  type GameRulesSnapshot,
  type MatchHeader,
  type MatchInfo,
  type Player,
  type Replay,
  type Round,
  type Shot,
  type TickBuffers,
} from "@/lib/replay/replayTypes";

/** Structure-of-arrays tick buffers sized for `playerCount * frameCount` slots. */
export function makeTicks(playerCount = 0, frameCount = 0): TickBuffers {
  const n = playerCount * frameCount;
  return {
    frameCount,
    playerCount,
    ticks: new Uint32Array(frameCount),
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    yaw: new Float32Array(n),
    health: new Uint8Array(n),
    armor: new Uint8Array(n),
    flags: new Uint8Array(n),
    money: new Uint16Array(n),
    equip: new Uint16Array(n),
    gear: new Uint16Array(n),
    primary: new Uint8Array(n),
    secondary: new Uint8Array(n),
    active: new Uint8Array(n),
    clip: new Uint8Array(n),
    reserve: new Uint16Array(n),
  };
}

/**
 * One frame at `tick` where every slot is present and alive, and the first
 * `ctCount` slots are CT. Use for rules that need a roster at freeze
 * (KAST survive, clutches, scoreboard sides).
 */
export function makeFreezeTicks(playerCount: number, ctCount: number, tick = 64): TickBuffers {
  const buf = makeTicks(playerCount, 1);
  buf.ticks[0] = tick;
  for (let i = 0; i < playerCount; i++) {
    buf.flags[i] = FLAG_PRESENT | FLAG_ALIVE | (i < ctCount ? FLAG_CT : 0);
    buf.health[i] = FULL_HEALTH;
  }
  return buf;
}

export function makePlayer(
  index: number,
  side: Player["start_side"],
  name: string,
  steamId = index + 1,
  isBot = false,
): Player {
  return { index, steam_id: steamId, name, start_side: side, is_bot: isBot };
}

export function makeRound(partial: Partial<Round> & Pick<Round, "number">): Round {
  return {
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 640,
    winner: "CT",
    win_reason: 8,
    score_ct: 0,
    score_t: 0,
    round_time_s: 0,
    is_knife: false,
    ...partial,
  };
}

export function makeKill(
  tick: number,
  attacker: number,
  victim: number,
  partial: Partial<Kill> = {},
): Kill {
  return {
    tick,
    attacker,
    victim,
    assister: -1,
    weapon: "ak47",
    headshot: false,
    assisted_flash: false,
    wallbang: false,
    noscope: false,
    through_smoke: false,
    attacker_blind: false,
    attacker_airborne: false,
    x: 0,
    y: 0,
    z: 0,
    attacker_x: 0,
    attacker_y: 0,
    attacker_z: 0,
    ...partial,
  };
}

export function makeHurt(
  tick: number,
  attacker: number,
  victim: number,
  damage: number,
  partial: Partial<Hurt> = {},
): Hurt {
  return {
    tick,
    attacker,
    victim,
    damage,
    damage_armor: 0,
    hitgroup: 0,
    health: 0,
    armor: 0,
    weapon: "ak47",
    ...partial,
  };
}

export function makeBlind(tick: number, attacker: number, victim: number, duration: number): Blind {
  return { tick, attacker, victim, duration };
}

export function makeShot(tick: number, player: number, partial: Partial<Shot> = {}): Shot {
  return { tick, player, x: 0, y: 0, yaw: 0, ...partial };
}

export function makeGrenade(
  partial: Partial<GrenadeThrow> & Pick<GrenadeThrow, "kind">,
): GrenadeThrow {
  return {
    thrower: 0,
    start_tick: 80,
    detonate_tick: 100,
    end_tick: 180,
    points: [],
    ...partial,
  };
}

export function makeBombEvent(
  partial: Partial<BombEvent> & Pick<BombEvent, "tick" | "kind">,
): BombEvent {
  return { player: 0, x: 0, y: 0, z: 0, haskit: false, ...partial };
}

/** Overrides for `makeReplay`; `header` is merged field by field. */
export type ReplayOverrides = Partial<Omit<Replay, "header">> & { header?: Partial<MatchHeader> };

export function makeReplay(overrides: ReplayOverrides = {}): Replay {
  const { header, ...rest } = overrides;
  return {
    header: {
      map_name: "de_anubis",
      tick_rate: DEFAULT_TICK_RATE,
      tick_stride: 4,
      duration_s: 10,
      playback_ticks: 1920,
      team_ct: "CT",
      team_t: "T",
      score_ct: 0,
      score_t: 0,
      ...header,
    },
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    rounds: [makeRound({ number: 1 })],
    grenades: [],
    shots: [],
    kills: [],
    hurts: [],
    blinds: [],
    bombEvents: [],
    buyEvents: [],
    ticks: makeTicks(),
    ...rest,
  };
}

/** Axis-aligned callout box in radar pixels. */
export function makeCallout(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
): LayoutCallout {
  return {
    id,
    name,
    floor: "default",
    regions: [
      {
        kind: "polygon",
        points: [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ],
      },
    ],
  };
}

/** Identity-scale calibration: world (x, y) maps to radar (x, 1024 - y). */
export const UNIT_CALIBRATION: MapCalibration = {
  pos_x: 0,
  pos_y: 1024,
  scale: 1,
  radar: "test.png",
};

const ZERO_RULES: GameRulesSnapshot = {
  m_nOvertimePlaying: 0,
  m_totalRoundsPlayed: 0,
  m_iRoundStartRoundNumber: 0,
  m_nRoundsPlayedThisPhase: 0,
  m_gamePhase: 0,
  m_iFreezeTime: 0,
  m_iRoundTime: 0,
  m_bFreezePeriod: false,
  m_bHasMatchStarted: false,
  m_bGamePaused: false,
  m_bMatchWaitingForResume: false,
  m_bTechnicalTimeOut: false,
  m_bCTTimeOutActive: false,
  m_bTerroristTimeOutActive: false,
  m_flCTTimeOutRemaining: 0,
  m_flTerroristTimeOutRemaining: 0,
  m_nCTTimeOuts: 0,
  m_nTerroristTimeOuts: 0,
  m_nPauseStartTick: 0,
  m_nTotalPausedTicks: 0,
  m_iNumConsecutiveCTLoses: 0,
  m_iNumConsecutiveTerroristLoses: 0,
  m_bBombPlanted: false,
  m_bBombDropped: false,
  m_eRoundEndReason: 0,
  m_iRoundEndWinnerTeam: 0,
  m_sRoundEndMessage: "",
  m_sRoundEndFunFactToken: "",
  m_iRoundEndFunFactPlayerSlot: 0,
  m_iRoundEndFunFactData1: 0,
  m_iRoundEndFunFactData2: 0,
  m_iRoundEndFunFactData3: 0,
  m_iRoundEndPlayerCount: 0,
  m_fMatchStartTime: 0,
  m_fRoundStartTime: 0,
  m_flGameStartTime: 0,
  m_bIsValveDS: false,
  m_bIsQueuedMatchmaking: false,
  m_nQueuedMatchmakingMode: 0,
  m_numBestOfMaps: 0,
  m_szMatchStatTxt: "",
  m_szTournamentEventName: "",
  m_szTournamentEventStage: "",
  m_vMinimapMins: [0, 0, 0],
  m_vMinimapMaxs: [0, 0, 0],
  m_bMapHasBombTarget: false,
  m_bMapHasBuyZone: false,
};

/** Parser `match_info` with the tournament defaults a drop must be able to read. */
export function sampleMatchInfo(patch: Partial<MatchInfo> = {}): MatchInfo {
  return {
    convars: {
      defaults: {
        mp_buytime: "20",
        mp_c4timer: "40",
        mp_maxmoney: "16000",
        mp_maxrounds: "24",
        mp_overtime_maxrounds: "6",
        mp_overtime_startmoney: "12500",
        mp_roundtime: "1.92",
        mp_roundtime_defuse: "1.92",
        mp_startmoney: "800",
      },
      // `mp_maxrounds` equals the default and is still present.
      demo: {
        mp_maxrounds: "24",
        mp_overtime_enable: "true",
      },
    },
    convar_updates: [{ tick: 0, name: "mp_maxrounds", value: "24" }],
    rules: { ...ZERO_RULES, m_nOvertimePlaying: 3 },
    teams: {
      ct: {
        name: "CT",
        m_iScore: 20,
        m_scoreFirstHalf: 7,
        m_scoreSecondHalf: 5,
        m_scoreOvertime: 8,
      },
      t: {
        name: "T",
        m_iScore: 22,
        m_scoreFirstHalf: 5,
        m_scoreSecondHalf: 7,
        m_scoreOvertime: 10,
      },
    },
    server_name: "FACEIT",
    build_num: 10924,
    patch_version: 14189,
    ...patch,
  };
}

export function makePlaces(callouts: LayoutCallout[], map = "de_test"): MapPlaces {
  const layout: MapLayout = { schema: LAYOUT_SCHEMA, map, callouts };
  return { layout, cal: UNIT_CALIBRATION };
}
