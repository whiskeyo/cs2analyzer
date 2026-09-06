export const FLAG_PRESENT = 1 << 0;
export const FLAG_ALIVE = 1 << 1;
export const FLAG_DUCKED = 1 << 2;
export const FLAG_SCOPED = 1 << 3;
export const FLAG_CT = 1 << 4;

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
}

export interface Round {
  number: number;
  start_tick: number;
  freeze_end_tick: number;
  end_tick: number;
  /** `cs_pre_restart` after live play; 0 when not seen (web falls back to a short cap). */
  playback_end_tick?: number;
  winner: Side | null;
  win_reason: number;
  score_ct: number;
  score_t: number;
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
  kind: "planted" | "defused" | "exploded" | "begin_defuse" | "abort_defuse";
  player: number;
  x: number;
  y: number;
  z: number;
  haskit?: boolean;
  /** 0 = A, 1 = B when the demo event includes a site index. */
  site?: number;
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
  impact: number;
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
  ticks: TickBuffers;
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
