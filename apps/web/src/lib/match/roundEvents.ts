import { grenadeRoundLastTick } from "@/lib/replay/sample";
import { tickRate } from "@/lib/shared/constants";
import { LEAD_IN_STORAGE_KEY } from "@/lib/shared/storageKeys";
import type {
  BombEvent,
  GrenadeKind,
  GrenadeThrow,
  Kill,
  Replay,
  Round,
} from "@/lib/replay/replayTypes";
import { formatClock } from "@/lib/weapons/weapons";

export const DEFAULT_LEAD_IN_SEC = 1.5;
export const MIN_LEAD_IN_SEC = 0;
export const MAX_LEAD_IN_SEC = 5;
export { LEAD_IN_STORAGE_KEY };

export type BombEventKind = BombEvent["kind"];

/** Round-timeline rows. Abort, pickup, and drop stay off the timeline. */
type TimelineBombKind = Exclude<BombEventKind, "abort_defuse" | "pickup" | "dropped">;

export type RoundEventKind = "kill" | "nade" | "bomb";

export interface RoundKillEvent {
  kind: "kill";
  key: string;
  tick: number;
  attacker: number;
  victim: number;
  weapon: string;
  headshot: boolean;
}

export interface RoundNadeEvent {
  kind: "nade";
  key: string;
  tick: number;
  thrower: number;
  nade: GrenadeKind;
}

export interface RoundBombEvent {
  kind: "bomb";
  key: string;
  tick: number;
  bomb: TimelineBombKind;
  player: number;
  haskit?: boolean;
}

export type RoundEvent = RoundKillEvent | RoundNadeEvent | RoundBombEvent;

export const NADE_WEAPON: Record<GrenadeKind, string> = {
  smoke: "smokegrenade",
  flash: "flashbang",
  he: "hegrenade",
  molotov: "molotov",
  incendiary: "incgrenade",
  decoy: "decoy",
};

export const NADE_LABEL: Record<GrenadeKind, string> = {
  smoke: "Smoke",
  flash: "Flash",
  he: "HE",
  molotov: "Molly",
  incendiary: "Incendiary",
  decoy: "Decoy",
};

export const BOMB_LABEL: Record<TimelineBombKind, string> = {
  planted: "Plant",
  defused: "Defuse",
  exploded: "Explode",
  begin_defuse: "Defusing",
  begin_plant: "Planting",
};

export const BOMB_WEAPON: Record<TimelineBombKind, string> = {
  planted: "c4",
  defused: "defuser",
  exploded: "planted_c4",
  begin_defuse: "defuser",
  begin_plant: "c4",
};

export function clampLeadInSec(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LEAD_IN_SEC;
  const stepped = Math.round(value * 2) / 2;
  return Math.min(MAX_LEAD_IN_SEC, Math.max(MIN_LEAD_IN_SEC, stepped));
}

export function loadLeadInSec(): number {
  try {
    const raw = localStorage.getItem(LEAD_IN_STORAGE_KEY);
    if (raw == null) return DEFAULT_LEAD_IN_SEC;
    return clampLeadInSec(Number(raw));
  } catch {
    return DEFAULT_LEAD_IN_SEC;
  }
}

export function saveLeadInSec(value: number): void {
  try {
    localStorage.setItem(LEAD_IN_STORAGE_KEY, String(clampLeadInSec(value)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function eventsForRound(replay: Replay, round: Round): RoundEvent[] {
  const from = round.start_tick;
  const to = round.end_tick;
  const out: RoundEvent[] = [];

  replay.kills.forEach((k, i) => {
    if (k.tick < from || k.tick > to) return;
    out.push(killEvent(k, i));
  });
  const grenadeLast = grenadeRoundLastTick(replay.rounds, round);
  replay.grenades.forEach((g, i) => {
    if (g.start_tick < from || g.start_tick > grenadeLast) return;
    out.push(nadeEvent(g, i));
  });
  replay.bombEvents.forEach((e, i) => {
    if (e.tick < from || e.tick > to) return;
    const bomb = bombEvent(e, i);
    if (bomb) out.push(bomb);
  });

  out.sort((a, b) => a.tick - b.tick || kindOrder(a.kind) - kindOrder(b.kind));
  return out;
}

export function jumpBefore(
  replay: Replay,
  round: Round,
  eventTick: number,
  leadInSec: number,
): number {
  const rate = tickRate(replay);
  const offset = Math.round(clampLeadInSec(leadInSec) * rate);
  const freeze = round.freeze_end_tick || round.start_tick;
  const floor = eventTick >= freeze ? freeze : round.start_tick;
  return Math.max(floor, eventTick - offset);
}

export function roundClock(round: Round, tick: number, tickRate: number): string {
  const rate = tickRate || 64;
  const origin = round.freeze_end_tick || round.start_tick;
  return formatClock(Math.max(0, (tick - origin) / rate));
}

function kindOrder(kind: RoundEventKind): number {
  if (kind === "nade") return 0;
  if (kind === "bomb") return 1;
  return 2;
}

function killEvent(k: Kill, index: number): RoundKillEvent {
  return {
    kind: "kill",
    key: `kill:${k.tick}:${k.attacker}:${k.victim}:${index}`,
    tick: k.tick,
    attacker: k.attacker,
    victim: k.victim,
    weapon: k.weapon,
    headshot: k.headshot,
  };
}

function nadeEvent(g: GrenadeThrow, index: number): RoundNadeEvent {
  return {
    kind: "nade",
    key: `nade:${g.start_tick}:${g.thrower}:${g.kind}:${index}`,
    tick: g.start_tick,
    thrower: g.thrower,
    nade: g.kind,
  };
}

function timelineBombKind(kind: BombEvent["kind"]): TimelineBombKind | null {
  switch (kind) {
    case "planted":
    case "defused":
    case "exploded":
    case "begin_defuse":
    case "begin_plant":
      return kind;
    case "abort_defuse":
    case "pickup":
    case "dropped":
      return null;
  }
}

function bombEvent(e: BombEvent, index: number): RoundBombEvent | null {
  const bomb = timelineBombKind(e.kind);
  if (!bomb) return null;
  return {
    kind: "bomb",
    key: `bomb:${e.tick}:${bomb}:${e.player}:${index}`,
    tick: e.tick,
    bomb,
    player: e.player,
    haskit: e.haskit,
  };
}

export function eventPlayer(e: RoundEvent): number {
  if (e.kind === "kill") return e.attacker;
  if (e.kind === "nade") return e.thrower;
  return e.player;
}
