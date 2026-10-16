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

/**
 * Nested `matchInfo` is not a flat row. `observed` is optional.
 * When it is present, `overtime_start_money` is a number or null.
 * `convars.demo.mp_overtime_startmoney` is optional.
 */
const MATCH_INFO_MARKER: Shape = {};

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
  matchInfo: MATCH_INFO_MARKER,
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

function describe(value: unknown): string {
  if (value === undefined) return "no value";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

function checkObject(where: string, value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PayloadError(`Parser sent ${describe(value)} for "${where}", expected an object.`);
  }
  return value as Record<string, unknown>;
}

function checkMatchInfo(value: unknown): void {
  const record = checkObject("matchInfo", value);
  const convars = checkObject("matchInfo.convars", record.convars);
  const demo = checkObject("matchInfo.convars.demo", convars.demo);
  const defaults = checkObject("matchInfo.convars.defaults", convars.defaults);
  const demoMoney = demo.mp_overtime_startmoney;
  if (demoMoney !== undefined && !number.ok(demoMoney)) {
    throw new PayloadError(
      `Parser payload "matchInfo.convars.demo" has ${describe(demoMoney)} for "mp_overtime_startmoney", ` +
        `expected ${number.expected}. The Rust field was probably renamed.`,
    );
  }
  if (!number.ok(defaults.mp_overtime_startmoney)) {
    throw new PayloadError(
      `Parser payload "matchInfo.convars.defaults" has ${describe(defaults.mp_overtime_startmoney)} for "mp_overtime_startmoney", ` +
        `expected ${number.expected}. The Rust field was probably renamed.`,
    );
  }
  if (record.observed === undefined) return;
  const observed = checkObject("matchInfo.observed", record.observed);
  if (!orNull(number).ok(observed.overtime_start_money)) {
    throw new PayloadError(
      `Parser payload "matchInfo.observed" has ${describe(observed.overtime_start_money)} for "overtime_start_money", ` +
        `expected ${orNull(number).expected}. The Rust field was probably renamed.`,
    );
  }
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
  const shape = PAYLOAD_SHAPES[name];
  for (const index of listSampleIndexes(value.length)) {
    checkShape(`${name}[${index}]`, value[index], shape);
  }
  return value as T[];
}
