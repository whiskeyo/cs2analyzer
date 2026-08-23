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
  winner: Side | null;
  win_reason: number;
  score_ct: number;
  score_t: number;
  is_knife: boolean;
  team_ct?: string;
  team_t?: string;
}

export type GrenadeKind = "smoke" | "flash" | "he" | "molotov" | "decoy";

export interface GrenadePoint {
  tick: number;
  x: number;
  y: number;
  z: number;
}

export interface GrenadeThrow {
  thrower: number;
  kind: GrenadeKind;
  start_tick: number;
  detonate_tick: number;
  end_tick: number;
  points: GrenadePoint[];
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
  x: number;
  y: number;
  z: number;
}

export interface Hurt {
  tick: number;
  attacker: number;
  victim: number;
  damage: number;
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
  kind: "planted" | "defused" | "exploded";
  player: number;
  x: number;
  y: number;
  z: number;
}

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
  hs_percent: number;
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
  kpr: number;
  dpr: number;
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
  stats: PlayerStats[];
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

export type WorkerOut =
  | { type: "progress"; current: number; total: number }
  | { type: "done"; replay: Replay }
  | { type: "error"; message: string };

export type DrawTool = "pan" | "pen" | "arrow" | "eraser";

export interface MapLayers {
  grenades: boolean;
  shots: boolean;
  names: boolean;
  deaths: boolean;
  cone: boolean;
  heatmap: boolean;
}

export const DEFAULT_LAYERS: MapLayers = {
  grenades: true,
  shots: true,
  names: true,
  deaths: true,
  cone: true,
  heatmap: false,
};

export type Stroke =
  | { type: "pen"; color: string; points: { x: number; y: number }[] }
  | { type: "arrow"; color: string; from: { x: number; y: number }; to: { x: number; y: number } };
