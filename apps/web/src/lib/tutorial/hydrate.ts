/**
 * Build a viewer `Replay` from the checked-in tutorial modules.
 *
 * Payload objects go through the same named `decode.ts` checks as a WASM drop.
 * Tick SoA arrays become TypedArrays. The CLI writes the data modules; this
 * file is only created when missing so later tour-loader edits stay.
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
import { TUTORIAL_FILENAME } from "./constants";
import { header as headerJson } from "./header";
import { players as playersJson } from "./players";
import { rounds as roundsJson } from "./rounds";
import {
  blinds as blindsJson,
  bombEvents as bombEventsJson,
  buyEvents as buyEventsJson,
  controllerDump as controllerDumpJson,
  grenades as grenadesJson,
  hurts as hurtsJson,
  kills as killsJson,
  shots as shotsJson,
} from "./events";
import {
  active,
  armor,
  clip,
  equip,
  flags,
  frameCount,
  gear,
  health,
  money,
  playerCount,
  primary,
  reserve,
  secondary,
  ticks,
  x,
  y,
  yaw,
  z,
} from "./ticks";

function tickLength(name: string, values: ArrayLike<number>, expected: number): void {
  if (values.length !== expected) {
    throw new PayloadError(
      `Tutorial fixture "${name}" has length ${values.length}, expected ${expected}.`,
    );
  }
}

function asTicks(): TickBuffers {
  const n = frameCount * playerCount;
  tickLength("ticks", ticks, frameCount);
  tickLength("x", x, n);
  tickLength("y", y, n);
  tickLength("z", z, n);
  tickLength("yaw", yaw, n);
  tickLength("health", health, n);
  tickLength("armor", armor, n);
  tickLength("flags", flags, n);
  tickLength("money", money, n);
  tickLength("equip", equip, n);
  tickLength("gear", gear, n);
  tickLength("primary", primary, n);
  tickLength("secondary", secondary, n);
  tickLength("active", active, n);
  tickLength("clip", clip, n);
  tickLength("reserve", reserve, n);
  return {
    frameCount,
    playerCount,
    ticks: new Uint32Array(ticks),
    x: new Float32Array(x),
    y: new Float32Array(y),
    z: new Float32Array(z),
    yaw: new Float32Array(yaw),
    health: new Uint8Array(health),
    armor: new Uint8Array(armor),
    flags: new Uint8Array(flags),
    money: new Uint16Array(money),
    equip: new Uint16Array(equip),
    gear: new Uint16Array(gear),
    primary: new Uint8Array(primary),
    secondary: new Uint8Array(secondary),
    active: new Uint8Array(active),
    clip: new Uint8Array(clip),
    reserve: new Uint16Array(reserve),
  };
}

/** Name-only handle so `LoadedDemo.file` stays typed without a real `.dem`. */
export function tutorialFileStub(): File {
  return new File([], TUTORIAL_FILENAME);
}

export function hydrateTutorialReplay(): Replay {
  return {
    header: decodeObject<MatchHeader>("header", JSON.stringify(headerJson)),
    players: decodeList<Player>("players", JSON.stringify(playersJson)),
    rounds: decodeList<Round>("rounds", JSON.stringify(roundsJson)),
    grenades: decodeList<GrenadeThrow>("grenades", JSON.stringify(grenadesJson)),
    shots: decodeList<Shot>("shots", JSON.stringify(shotsJson)),
    kills: decodeList<Kill>("kills", JSON.stringify(killsJson)),
    hurts: decodeList<Hurt>("hurts", JSON.stringify(hurtsJson)),
    blinds: decodeList<Blind>("blinds", JSON.stringify(blindsJson)),
    bombEvents: decodeList<BombEvent>("bombEvents", JSON.stringify(bombEventsJson)),
    buyEvents: decodeList<BuyEvent>("buyEvents", JSON.stringify(buyEventsJson)),
    controllerDump: decodeList<ControllerDump>(
      "controllerDump",
      JSON.stringify(controllerDumpJson),
    ),
    ticks: asTicks(),
  };
}
