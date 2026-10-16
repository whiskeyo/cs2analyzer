/**
 * Checks the JSON the parser hands over before it becomes a `Replay`.
 *
 * `JSON.parse` returns `any`, so `replayTypes.ts` — which is hand-mirrored from
 * `crates/cs2analyzer/src/types.rs` — only describes what the parser *should*
 * send. A serde rename on the Rust side would otherwise produce objects full of
 * `undefined` with a green typecheck, and the first sign of it would be a blank
 * radar. These checks turn that into a named error on the drop screen.
 */

import { parseJson as parseJsonText } from "@/lib/validate/json.ts";

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}

interface Check {
  expected: string;
  ok: (value: unknown) => boolean;
}

const number: Check = {
  expected: "number",
  ok: (v) => typeof v === "number" && Number.isFinite(v),
};
const text: Check = { expected: "string", ok: (v) => typeof v === "string" };
const flag: Check = { expected: "boolean", ok: (v) => typeof v === "boolean" };
const list: Check = { expected: "array", ok: (v) => Array.isArray(v) };

function orNull(check: Check): Check {
  return { expected: `${check.expected} or null`, ok: (v) => v === null || check.ok(v) };
}

type Shape = Record<string, Check>;

/**
 * Fields TypeScript marks required on `replayTypes.ts`. Optional TS fields
 * (`playback_end_tick`, `team_ct` / `team_t`, `GrenadeThrow.fires`,
 * `BombEvent.site`) stay off this list — they are optional in the
 * types, not `#[serde(default)]` shims for stale WASM caches.
 *
 * `round_time_s` is required on `Round`, but demos parsed before that field
 * and kept in IndexedDB omit it. A missing value becomes `0` (HUD fallback).
 * A present value that is not a number still fails.
 */
const HEADER: Shape = {
  map_name: text,
  tick_rate: number,
  tick_stride: number,
  duration_s: number,
  playback_ticks: number,
  team_ct: text,
  team_t: text,
  score_ct: number,
  score_t: number,
};

const PLAYER: Shape = {
  index: number,
  steam_id: number,
  name: text,
  start_side: text,
  is_bot: flag,
};

const ROUND: Shape = {
  number: number,
  start_tick: number,
  freeze_end_tick: number,
  end_tick: number,
  winner: orNull(text),
  win_reason: number,
  score_ct: number,
  score_t: number,
  round_time_s: number,
  is_knife: flag,
};

/** Older stored round JSON has no `round_time_s`. `0` means "unknown". */
function fillMissingRoundTime(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.round_time_s === undefined) {
    record.round_time_s = 0;
  }
}

const GRENADE: Shape = {
  thrower: number,
  kind: text,
  start_tick: number,
  detonate_tick: number,
  end_tick: number,
  points: list,
};

const SHOT: Shape = { tick: number, player: number, x: number, y: number, yaw: number };

const KILL: Shape = {
  tick: number,
  attacker: number,
  victim: number,
  assister: number,
  weapon: text,
  headshot: flag,
  assisted_flash: flag,
  wallbang: flag,
  noscope: flag,
  through_smoke: flag,
  attacker_blind: flag,
  attacker_airborne: flag,
  x: number,
  y: number,
  z: number,
  attacker_x: number,
  attacker_y: number,
  attacker_z: number,
};

const HURT: Shape = {
  tick: number,
  attacker: number,
  victim: number,
  damage: number,
  damage_armor: number,
  hitgroup: number,
  health: number,
  armor: number,
  weapon: text,
};

const BLIND: Shape = { tick: number, attacker: number, victim: number, duration: number };

const BOMB_EVENT: Shape = {
  tick: number,
  kind: text,
  player: number,
  x: number,
  y: number,
  z: number,
  haskit: flag,
};

const BUY_EVENT: Shape = { tick: number, player: number, weapon: number, cost: number };

const CONTROLLER_DUMP: Shape = {
  tick: number,
  slot: number,
  name: text,
  steam: number,
  is_bot: flag,
  connected: number,
  has_team_pawn: flag,
  assigned: number,
  at_freeze: flag,
};

const ROUND_SCOREBOARD: Shape = {
  round: number,
  players: list,
};

const ROUND_SCOREBOARD_PLAYER: Shape = {
  steam_id: number,
  slot: number,
  name: text,
  kills: number,
  deaths: number,
  assists: number,
  damage: number,
  headshot_kills: number,
  utility_damage: number,
  enemies_flashed: number,
};

const object: Check = {
  expected: "object",
  ok: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
};

const vec3: Check = {
  expected: "array of 3 numbers",
  ok: (v) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((item) => typeof item === "number" && Number.isFinite(item)),
};

const CONVAR_UPDATE: Shape = { tick: number, name: text, value: text };

const TEAM_HALF: Shape = {
  name: text,
  m_iScore: number,
  m_scoreFirstHalf: number,
  m_scoreSecondHalf: number,
  m_scoreOvertime: number,
};

const RULES_NUMBERS = [
  "m_nOvertimePlaying",
  "m_totalRoundsPlayed",
  "m_iRoundStartRoundNumber",
  "m_nRoundsPlayedThisPhase",
  "m_gamePhase",
  "m_iFreezeTime",
  "m_iRoundTime",
  "m_flCTTimeOutRemaining",
  "m_flTerroristTimeOutRemaining",
  "m_nCTTimeOuts",
  "m_nTerroristTimeOuts",
  "m_nPauseStartTick",
  "m_nTotalPausedTicks",
  "m_iNumConsecutiveCTLoses",
  "m_iNumConsecutiveTerroristLoses",
  "m_eRoundEndReason",
  "m_iRoundEndWinnerTeam",
  "m_iRoundEndFunFactPlayerSlot",
  "m_iRoundEndFunFactData1",
  "m_iRoundEndFunFactData2",
  "m_iRoundEndFunFactData3",
  "m_iRoundEndPlayerCount",
  "m_fMatchStartTime",
  "m_fRoundStartTime",
  "m_flGameStartTime",
  "m_nQueuedMatchmakingMode",
  "m_numBestOfMaps",
] as const;

const RULES_FLAGS = [
  "m_bFreezePeriod",
  "m_bHasMatchStarted",
  "m_bGamePaused",
  "m_bMatchWaitingForResume",
  "m_bTechnicalTimeOut",
  "m_bCTTimeOutActive",
  "m_bTerroristTimeOutActive",
  "m_bBombPlanted",
  "m_bBombDropped",
  "m_bIsValveDS",
  "m_bIsQueuedMatchmaking",
  "m_bMapHasBombTarget",
  "m_bMapHasBuyZone",
] as const;

const RULES_TEXT = [
  "m_sRoundEndMessage",
  "m_sRoundEndFunFactToken",
  "m_szMatchStatTxt",
  "m_szTournamentEventName",
  "m_szTournamentEventStage",
] as const;

const RULES: Shape = {
  ...Object.fromEntries(RULES_NUMBERS.map((field) => [field, number])),
  ...Object.fromEntries(RULES_FLAGS.map((field) => [field, flag])),
  ...Object.fromEntries(RULES_TEXT.map((field) => [field, text])),
  m_vMinimapMins: vec3,
  m_vMinimapMaxs: vec3,
};

const MATCH_INFO: Shape = {
  convars: object,
  convar_updates: list,
  rules: object,
  teams: object,
  server_name: text,
  build_num: number,
  patch_version: number,
};

export const PAYLOAD_SHAPES = {
  header: HEADER,
  players: PLAYER,
  rounds: ROUND,
  grenades: GRENADE,
  shots: SHOT,
  kills: KILL,
  hurts: HURT,
  blinds: BLIND,
  bombEvents: BOMB_EVENT,
  buyEvents: BUY_EVENT,
  controllerDump: CONTROLLER_DUMP,
  roundScoreboard: ROUND_SCOREBOARD,
  matchInfo: MATCH_INFO,
} as const;

export type PayloadName = keyof typeof PAYLOAD_SHAPES;

function parseJson(name: string, json: string): unknown {
  try {
    return parseJsonText(json);
  } catch {
    throw new PayloadError(`Parser sent invalid JSON for "${name}".`);
  }
}

function checkShape(where: string, value: unknown, shape: Shape): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PayloadError(`Parser sent ${describe(value)} for "${where}", expected an object.`);
  }
  const record = value as Record<string, unknown>;
  for (const [field, check] of Object.entries(shape)) {
    if (!check.ok(record[field])) {
      throw new PayloadError(
        `Parser payload "${where}" has ${describe(record[field])} for "${field}", ` +
          `expected ${check.expected}. The Rust field was probably renamed.`,
      );
    }
  }
}

function checkRoundScoreboard(value: unknown, index: number): void {
  checkShape(`roundScoreboard[${index}]`, value, ROUND_SCOREBOARD);
  const players = (value as { players?: unknown }).players;
  if (!Array.isArray(players)) {
    return;
  }
  for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
    checkShape(
      `roundScoreboard[${index}].players[${playerIndex}]`,
      players[playerIndex],
      ROUND_SCOREBOARD_PLAYER,
    );
  }
}

function describe(value: unknown): string {
  if (value === undefined) return "no value";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

function checkStringRecord(where: string, value: unknown): void {
  if (!object.ok(value)) {
    throw new PayloadError(`Parser sent ${describe(value)} for "${where}", expected an object.`);
  }
  const record = value as Record<string, unknown>;
  for (const [name, entry] of Object.entries(record)) {
    if (typeof entry !== "string") {
      throw new PayloadError(
        `Parser payload "${where}.${name}" has ${describe(entry)}, expected string.`,
      );
    }
  }
}

function checkConvars(where: string, value: unknown): void {
  if (!object.ok(value)) {
    throw new PayloadError(`Parser sent ${describe(value)} for "${where}", expected an object.`);
  }
  const record = value as Record<string, unknown>;
  checkStringRecord(`${where}.defaults`, record.defaults);
  checkStringRecord(`${where}.demo`, record.demo);
}

function checkMatchInfo(value: unknown): void {
  checkShape("matchInfo", value, MATCH_INFO);
  const record = value as Record<string, unknown>;
  checkConvars("matchInfo.convars", record.convars);
  if (!Array.isArray(record.convar_updates)) {
    throw new PayloadError(
      `Parser sent ${describe(record.convar_updates)} for "matchInfo.convar_updates", expected an array.`,
    );
  }
  for (const [index, update] of record.convar_updates.entries()) {
    checkShape(`matchInfo.convar_updates[${index}]`, update, CONVAR_UPDATE);
  }
  checkShape("matchInfo.rules", record.rules, RULES);
  if (!object.ok(record.teams)) {
    throw new PayloadError(
      `Parser sent ${describe(record.teams)} for "matchInfo.teams", expected an object.`,
    );
  }
  const teams = record.teams as Record<string, unknown>;
  checkShape("matchInfo.teams.ct", teams.ct, TEAM_HALF);
  checkShape("matchInfo.teams.t", teams.t, TEAM_HALF);
}

export function decodeObject<T>(name: PayloadName, json: string): T {
  const value = parseJson(name, json);
  if (name === "matchInfo") {
    checkMatchInfo(value);
    return value as T;
  }
  checkShape(name, value, PAYLOAD_SHAPES[name]);
  return value as T;
}

/**
 * Extra samples between first and last. Walking every kill on drop is too
 * expensive; a mid-list serde rename still fails if it lands on a sample.
 */
export const DECODE_LIST_SAMPLE_STRIDE = 256;

function listSampleIndexes(length: number): number[] {
  if (length === 0) return [];
  const indexes = [0];
  if (length > 1) indexes.push(length - 1);
  for (let i = DECODE_LIST_SAMPLE_STRIDE; i < length - 1; i += DECODE_LIST_SAMPLE_STRIDE) {
    indexes.push(i);
  }
  return indexes;
}

/**
 * Checks first, last, and a stride of elements. An empty array passes — a
 * quiet demo looks the same to the UI.
 */
export function decodeList<T>(name: PayloadName, json: string): T[] {
  const value = parseJson(name, json);
  if (!Array.isArray(value)) {
    throw new PayloadError(`Parser sent ${describe(value)} for "${name}", expected an array.`);
  }
  if (name === "rounds") {
    for (const item of value) {
      fillMissingRoundTime(item);
    }
  }
  if (name === "roundScoreboard") {
    for (let index = 0; index < value.length; index += 1) {
      checkRoundScoreboard(value[index], index);
    }
    return value as T[];
  }
  const shape = PAYLOAD_SHAPES[name];
  for (const index of listSampleIndexes(value.length)) {
    checkShape(`${name}[${index}]`, value[index], shape);
  }
  return value as T[];
}
