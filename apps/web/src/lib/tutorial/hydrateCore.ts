/**
 * Shared Replay assembly for single-demo and multi-demo tutorial fixtures.
 * Generated modules stay out of this file so a dynamic `import()` can split them.
 */

import { decodeList, decodeObject, PayloadError } from "@/lib/parse/decode";
import type {
  Blind,
  BombEvent,
  BuyEvent,
  ControllerDump,
  GrenadeThrow,
  Hurt,
  Kill,
  MatchHeader,
  Player,
  Replay,
  Round,
  Shot,
  TickBuffers,
} from "@/lib/replay/replayTypes";

export interface TutorialTickArrays {
  frameCount: number;
  playerCount: number;
  ticks: ArrayLike<number>;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  z: ArrayLike<number>;
  yaw: ArrayLike<number>;
  health: ArrayLike<number>;
  armor: ArrayLike<number>;
  flags: ArrayLike<number>;
  money: ArrayLike<number>;
  equip: ArrayLike<number>;
  gear: ArrayLike<number>;
  primary: ArrayLike<number>;
  secondary: ArrayLike<number>;
  active: ArrayLike<number>;
  clip: ArrayLike<number>;
  reserve: ArrayLike<number>;
}

export interface TutorialEventJson {
  grenades: unknown;
  shots: unknown;
  kills: unknown;
  hurts: unknown;
  blinds: unknown;
  bombEvents: unknown;
  buyEvents: unknown;
  controllerDump: unknown;
}

function tickLength(name: string, values: ArrayLike<number>, expected: number): void {
  if (values.length !== expected) {
    throw new PayloadError(
      `Tutorial fixture "${name}" has length ${values.length}, expected ${expected}.`,
    );
  }
}

export function ticksFromArrays(arrays: TutorialTickArrays): TickBuffers {
  const n = arrays.frameCount * arrays.playerCount;
  tickLength("ticks", arrays.ticks, arrays.frameCount);
  tickLength("x", arrays.x, n);
  tickLength("y", arrays.y, n);
  tickLength("z", arrays.z, n);
  tickLength("yaw", arrays.yaw, n);
  tickLength("health", arrays.health, n);
  tickLength("armor", arrays.armor, n);
  tickLength("flags", arrays.flags, n);
  tickLength("money", arrays.money, n);
  tickLength("equip", arrays.equip, n);
  tickLength("gear", arrays.gear, n);
  tickLength("primary", arrays.primary, n);
  tickLength("secondary", arrays.secondary, n);
  tickLength("active", arrays.active, n);
  tickLength("clip", arrays.clip, n);
  tickLength("reserve", arrays.reserve, n);
  return {
    frameCount: arrays.frameCount,
    playerCount: arrays.playerCount,
    ticks: new Uint32Array(arrays.ticks),
    x: new Float32Array(arrays.x),
    y: new Float32Array(arrays.y),
    z: new Float32Array(arrays.z),
    yaw: new Float32Array(arrays.yaw),
    health: new Uint8Array(arrays.health),
    armor: new Uint8Array(arrays.armor),
    flags: new Uint8Array(arrays.flags),
    money: new Uint16Array(arrays.money),
    equip: new Uint16Array(arrays.equip),
    gear: new Uint16Array(arrays.gear),
    primary: new Uint8Array(arrays.primary),
    secondary: new Uint8Array(arrays.secondary),
    active: new Uint8Array(arrays.active),
    clip: new Uint8Array(arrays.clip),
    reserve: new Uint16Array(arrays.reserve),
  };
}

export function hydrateReplayFromModules(
  headerJson: unknown,
  playersJson: unknown,
  roundsJson: unknown,
  events: TutorialEventJson,
  tickArrays: TutorialTickArrays,
): Replay {
  return {
    header: decodeObject<MatchHeader>("header", JSON.stringify(headerJson)),
    players: decodeList<Player>("players", JSON.stringify(playersJson)),
    rounds: decodeList<Round>("rounds", JSON.stringify(roundsJson)),
    grenades: decodeList<GrenadeThrow>("grenades", JSON.stringify(events.grenades)),
    shots: decodeList<Shot>("shots", JSON.stringify(events.shots)),
    kills: decodeList<Kill>("kills", JSON.stringify(events.kills)),
    hurts: decodeList<Hurt>("hurts", JSON.stringify(events.hurts)),
    blinds: decodeList<Blind>("blinds", JSON.stringify(events.blinds)),
    bombEvents: decodeList<BombEvent>("bombEvents", JSON.stringify(events.bombEvents)),
    buyEvents: decodeList<BuyEvent>("buyEvents", JSON.stringify(events.buyEvents)),
    controllerDump: decodeList<ControllerDump>(
      "controllerDump",
      JSON.stringify(events.controllerDump),
    ),
    ticks: ticksFromArrays(tickArrays),
  };
}
