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
 * `BombEvent.haskit` / `site`) stay off this list — they are optional in the
 * types, not `#[serde(default)]` shims for stale WASM caches.
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
  is_knife: flag,
};

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
};

const BUY_EVENT: Shape = { tick: number, player: number, weapon: number, cost: number };

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

export function decodeObject<T>(name: PayloadName, json: string): T {
  const value = parseJson(name, json);
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
  const shape = PAYLOAD_SHAPES[name];
  for (const index of listSampleIndexes(value.length)) {
    checkShape(`${name}[${index}]`, value[index], shape);
  }
  return value as T[];
}
