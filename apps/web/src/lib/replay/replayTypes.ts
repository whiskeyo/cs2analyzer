export const FLAG_PRESENT = 1 << 0;
export const FLAG_ALIVE = 1 << 1;
export const FLAG_DUCKED = 1 << 2;
export const FLAG_SCOPED = 1 << 3;
export const FLAG_CT = 1 << 4;
export const FLAG_PLANTING = 1 << 5;
export const FLAG_DEFUSING = 1 << 6;

export const GEAR_HE = 1 << 0;
export const GEAR_FLASH = 1 << 1;
export const GEAR_FLASH2 = 1 << 2;
export const GEAR_SMOKE = 1 << 3;
export const GEAR_MOLLY = 1 << 4;
export const GEAR_DECOY = 1 << 5;
export const GEAR_HELMET = 1 << 6;
export const GEAR_DEFUSER = 1 << 7;
export const GEAR_ZEUS = 1 << 8;
export const GEAR_C4 = 1 << 9;
export const GEAR_KEVLAR = 1 << 10;
export const GEAR_INC = 1 << 11;

export type Side = "T" | "CT";

export interface MatchHeader {
  map_name: string;
  tick_rate: number;
  tick_stride: number;
  duration_s: number;
  playback_ticks: number;
  team_ct: string;
  team_t: string;
  score_ct: number;
  score_t: number;
}

export interface Player {
  index: number;
  steam_id: number;
  name: string;
  start_side: Side;
  /** GOTV / offline bot (`m_bIsBot`, synthetic steam id). */
  is_bot: boolean;
}

/**
 * Cumulative `m_pActionTrackingServices.m_matchStats` for one controller at round end.
 * `steam_id` is raw `m_steamID` (0 for a genuine bot). `slot` is the controller index.
 */
export interface RoundScoreboardPlayer {
  steam_id: number;
  slot: number;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshot_kills: number;
  utility_damage: number;
  enemies_flashed: number;
}

/** One counted round. `round` matches `Round.number`. Knife rounds are omitted. */
export interface RoundScoreboard {
  round: number;
  players: RoundScoreboardPlayer[];
}

/** Per-controller parse diagnostic from WASM. Not used by radar/stats. */
export interface ControllerDump {
  tick: number;
  slot: number;
  name: string;
  steam: number;
  is_bot: boolean;
  connected: number;
  has_team_pawn: boolean;
  assigned: number;
  at_freeze: boolean;
}

export interface Round {
  number: number;
  start_tick: number;
  freeze_end_tick: number;
  end_tick: number;
  /**
   * Post-round playback end. Usually the first `cs_pre_restart` after the win.
   * When that restart would cross a skipped warmup, this is the last kept frame
   * before the hole. `0` when none falls in the kept range (short web cap).
   */
  playback_end_tick?: number;
  winner: Side | null;
  win_reason: number;
  score_ct: number;
  score_t: number;
  /** `m_iRoundTime` at freeze end, seconds. `0` when the demo did not carry it. */
  round_time_s: number;
  is_knife: boolean;
  team_ct?: string;
  team_t?: string;
}

export type GrenadeKind = "smoke" | "flash" | "he" | "molotov" | "incendiary" | "decoy";

export function isFireGrenade(kind: GrenadeKind): boolean {
  return kind === "molotov" || kind === "incendiary";
}

/** Filter / chip key for fire nades — molly and inc share one control. */
export function nadeFilterKind(kind: GrenadeKind): GrenadeKind {
  return isFireGrenade(kind) ? "molotov" : kind;
}

export interface GrenadePoint {
  tick: number;
  x: number;
  y: number;
  z: number;
}

export interface FireCell {
  x: number;
  y: number;
  start_tick: number;
  end_tick: number;
}

export interface GrenadeThrow {
  thrower: number;
  kind: GrenadeKind;
  start_tick: number;
  detonate_tick: number;
  end_tick: number;
  points: GrenadePoint[];
  fires?: FireCell[];
}

export interface Shot {
  tick: number;
  player: number;
  x: number;
  y: number;
  yaw: number;
}

export interface Kill {
  tick: number;
  attacker: number;
  victim: number;
  assister: number;
  weapon: string;
  headshot: boolean;
  assisted_flash: boolean;
  wallbang: boolean;
  noscope: boolean;
  through_smoke: boolean;
  attacker_blind: boolean;
  attacker_airborne: boolean;
  x: number;
  y: number;
  z: number;
  attacker_x: number;
  attacker_y: number;
  attacker_z: number;
}

export interface Hurt {
  tick: number;
  attacker: number;
  victim: number;
  damage: number;
  damage_armor: number;
  hitgroup: number;
  health: number;
  armor: number;
  weapon: string;
}

export interface Blind {
  tick: number;
  attacker: number;
  victim: number;
  duration: number;
}

export interface BombEvent {
  tick: number;
  kind:
    | "planted"
    | "defused"
    | "exploded"
    | "begin_defuse"
    | "abort_defuse"
    | "pickup"
    | "dropped"
    | "begin_plant";
  player: number;
  x: number;
  y: number;
  z: number;
  haskit: boolean;
  /** 0 = A, 1 = B when the demo event includes a site index. */
  site?: number;
}

export interface BuyEvent {
  tick: number;
  player: number;
  weapon: number;
  cost: number;
}

/**
 * Live scoreboard row. Computed in the browser by `lib/stats/stats.ts` through
 * the current tick; the parser's own `PlayerStats` is a whole-match snapshot and
 * is not shipped to the viewer.
 */
export interface PlayerStats {
  player: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  damage: number;
  utility_damage: number;
  enemies_flashed: number;
  first_kills: number;
  first_deaths: number;
  kast_rounds: number;
  rounds: number;
  adr: number;
  headshot_percent: number;
  kast: number;
  kd: number;
  multi_kills_2: number;
  multi_kills_3: number;
  multi_kills_4: number;
  aces: number;
  flash_assists: number;
  plants: number;
  defuses: number;
  trade_kills: number;
  trade_deaths: number;
  entry_attempts: number;
  entry_success: number;
  rounds_ct: number;
  rounds_t: number;
  kills_ct: number;
  kills_t: number;
  deaths_ct: number;
  deaths_t: number;
  damage_ct: number;
  damage_t: number;
  adr_ct: number;
  adr_t: number;
  kills_per_round: number;
  deaths_per_round: number;
  /** Standardized firepower pillar (K/D diff + ADR). */
  rating_firepower: number;
  /** Standardized impact pillar (entry + multikills). */
  rating_impact: number;
  /** Standardized support pillar (KAST + trades + utility). */
  rating_support: number;
  /** Standardized clutch/objective pillar. */
  rating_clutch: number;
  /** 1.00 floor, unclipped high; ~5.25 is a typical game. */
  rating: number;
  flash_time: number;
  nades: number;
  he_kills: number;
  survived: number;
  clutch_attempts: number;
  clutch_wins: number;
  clutch_1v1: number;
  clutch_1v2: number;
  clutch_1v3: number;
  clutch_1v4: number;
  clutch_1v5: number;
  clutch_1v1_attempts: number;
  clutch_1v2_attempts: number;
  clutch_1v3_attempts: number;
  clutch_1v4_attempts: number;
  clutch_1v5_attempts: number;
  damage_taken: number;
}

export interface TickBuffers {
  frameCount: number;
  playerCount: number;
  ticks: Uint32Array;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  yaw: Float32Array;
  health: Uint8Array;
  armor: Uint8Array;
  flags: Uint8Array;
  money: Uint16Array;
  equip: Uint16Array;
  gear: Uint16Array;
  primary: Uint8Array;
  secondary: Uint8Array;
  active: Uint8Array;
  clip: Uint8Array;
  reserve: Uint16Array;
}

/**
 * Tournament defaults plus every convar the server sent.
 *
 * Resolve a name with `demo[name] ?? defaults[name]`. `defaults` is always
 * present. `demo` keeps the server's last value even when it equals the default.
 * A name the demo never sent is absent from `demo`.
 */
export interface ConvarTables {
  defaults: Record<string, string>;
  demo: Record<string, string>;
}

/** A `CNETMsg_SetConVar` change. Repeats of the same value are omitted. */
export interface ConvarUpdate {
  tick: number;
  name: string;
  value: string;
}

/** `CCSTeam` half split. Score fields use the networked prop names. */
export interface TeamHalfScores {
  name: string;
  m_iScore: number;
  m_scoreFirstHalf: number;
  m_scoreSecondHalf: number;
  m_scoreOvertime: number;
}

/**
 * `CCSGameRules` at the end of the demo.
 * `m_nOvertimePlaying` is 0 in regulation and the OT period index after that.
 */
export interface GameRulesSnapshot {
  m_nOvertimePlaying: number;
  m_totalRoundsPlayed: number;
  m_iRoundStartRoundNumber: number;
  m_nRoundsPlayedThisPhase: number;
  m_gamePhase: number;
  m_iFreezeTime: number;
  m_iRoundTime: number;
  m_bFreezePeriod: boolean;
  m_bHasMatchStarted: boolean;
  m_bGamePaused: boolean;
  m_bMatchWaitingForResume: boolean;
  m_bTechnicalTimeOut: boolean;
  m_bCTTimeOutActive: boolean;
  m_bTerroristTimeOutActive: boolean;
  m_flCTTimeOutRemaining: number;
  m_flTerroristTimeOutRemaining: number;
  m_nCTTimeOuts: number;
  m_nTerroristTimeOuts: number;
  m_nPauseStartTick: number;
  m_nTotalPausedTicks: number;
  m_iNumConsecutiveCTLoses: number;
  m_iNumConsecutiveTerroristLoses: number;
  m_bBombPlanted: boolean;
  m_bBombDropped: boolean;
  m_eRoundEndReason: number;
  m_iRoundEndWinnerTeam: number;
  m_sRoundEndMessage: string;
  m_sRoundEndFunFactToken: string;
  m_iRoundEndFunFactPlayerSlot: number;
  m_iRoundEndFunFactData1: number;
  m_iRoundEndFunFactData2: number;
  m_iRoundEndFunFactData3: number;
  m_iRoundEndPlayerCount: number;
  m_fMatchStartTime: number;
  m_fRoundStartTime: number;
  m_flGameStartTime: number;
  m_bIsValveDS: boolean;
  m_bIsQueuedMatchmaking: boolean;
  m_nQueuedMatchmakingMode: number;
  m_numBestOfMaps: number;
  m_szMatchStatTxt: string;
  m_szTournamentEventName: string;
  m_szTournamentEventStage: string;
  m_vMinimapMins: [number, number, number];
  m_vMinimapMaxs: [number, number, number];
  m_bMapHasBombTarget: boolean;
  m_bMapHasBuyZone: boolean;
}

/**
 * Cash read off players. `overtime_start_money` is null when the match has no
 * overtime or the balances disagree. There is no platform field.
 */
export interface ObservedMatch {
  overtime_start_money: number | null;
}

/**
 * Extra demo data. Omitted on replays parsed before this field existed.
 *
 * Look up a convar with `getConvar` (`demo[name] ?? defaults[name]`).
 * Rust does not infer overtime or round-limit numbers. The timeline reads
 * `mp_maxrounds` and `mp_overtime_maxrounds` for period boundaries, and uses
 * side swaps for the half line inside each period.
 * `observed` is optional so a payload from before this object still loads.
 * A fresh parse always sends it.
 */
export interface MatchInfo {
  convars: ConvarTables;
  convar_updates: ConvarUpdate[];
  rules: GameRulesSnapshot;
  teams: { ct: TeamHalfScores; t: TeamHalfScores };
  server_name: string;
  build_num: number;
  patch_version: number;
  observed?: ObservedMatch;
}

export interface Replay {
  header: MatchHeader;
  players: Player[];
  rounds: Round[];
  grenades: GrenadeThrow[];
  shots: Shot[];
  kills: Kill[];
  hurts: Hurt[];
  blinds: Blind[];
  bombEvents: BombEvent[];
  buyEvents: BuyEvent[];
  ticks: TickBuffers;
  /** Last controller slot + freeze-end fill candidates. */
  controllerDump?: ControllerDump[];
  /**
   * Round-end action-tracking scoreboard. Optional so a replay cached before
   * this field existed still loads.
   */
  roundScoreboard?: RoundScoreboard[];
  /** Convars, gamerules, half scores, and the demo file header. */
  match_info?: MatchInfo;
}

export interface FloorSection {
  name: string;
  z_min: number;
  z_max: number;
}

export interface MapCalibration {
  pos_x: number;
  pos_y: number;
  scale: number;
  radar: string;
  lower_radar?: string;
  floors?: FloorSection[];
}

/** Worker-side parse breakdown. `parseMs` is the WASM `parseDemo` call. */
export interface ParseTimings {
  initMs: number;
  parseMs: number;
  jsonMs: number;
  buffersMs: number;
  totalMs: number;
}

export type WorkerOut =
  | { type: "progress"; current: number; total: number }
  | { type: "done"; replay: Replay; timings: ParseTimings }
  | { type: "error"; message: string };
