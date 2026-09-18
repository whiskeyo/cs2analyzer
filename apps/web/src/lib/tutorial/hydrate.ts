/**
 * Build a viewer `Replay` from the checked-in tutorial modules.
 *
 * Payload objects go through the same named `decode.ts` checks as a WASM drop.
 * Tick SoA arrays become TypedArrays. The CLI writes the data modules; this
 * file is only created when missing so later tour-loader edits stay.
 */

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
import { hydrateReplayFromModules } from "./hydrateCore";
import type { Replay } from "@/lib/replay/replayTypes";

/** Name-only handle so `LoadedDemo.file` stays typed without a real `.dem`. */
export function tutorialFileStub(): File {
  return new File([], TUTORIAL_FILENAME);
}

export function hydrateTutorialReplay(): Replay {
  return hydrateReplayFromModules(
    headerJson,
    playersJson,
    roundsJson,
    {
      grenades: grenadesJson,
      shots: shotsJson,
      kills: killsJson,
      hurts: hurtsJson,
      blinds: blindsJson,
      bombEvents: bombEventsJson,
      buyEvents: buyEventsJson,
      controllerDump: controllerDumpJson,
    },
    {
      frameCount,
      playerCount,
      ticks,
      x,
      y,
      z,
      yaw,
      health,
      armor,
      flags,
      money,
      equip,
      gear,
      primary,
      secondary,
      active,
      clip,
      reserve,
    },
  );
}
