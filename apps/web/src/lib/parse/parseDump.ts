import { FLASH_OVERLAY_SPIKE_SECONDS } from "@/lib/shared/constants";
import { playerLabel } from "@/lib/replay/playerLabel";
import { samplePlayers } from "@/lib/replay/sample";
import type { ControllerDump, Replay } from "@/lib/replay/replayTypes";

export interface ParseDumpPlayer {
  name: string;
  steam: number;
  start: string;
  is_bot: boolean;
}

export interface ParseDumpPresent {
  name: string;
  steam: number;
  is_bot: boolean;
  alive: boolean;
  money: number;
  ct: boolean;
}

export interface ParseDumpRound {
  n: number;
  present: ParseDumpPresent[];
}

export interface ParseDumpController {
  tick: number;
  slot: number;
  name: string;
  steam: number;
  isBot: boolean;
  connected: number;
  pawn: boolean;
  assigned: number;
}

/** Compact parse dump so a re-drop can prove what WASM actually emitted. */
export function parseDump(replay: Replay): {
  players: ParseDumpPlayer[];
  presentAtEnd: ParseDumpPresent[];
  botCount: number;
  botIds: number[];
  worldKills: number;
  worldKillTicks: number[];
  controllers: ParseDumpController[];
  fillFreeze: ParseDumpController[];
  rounds: ParseDumpRound[];
  blinds: number;
  overlayBlinds: number;
  overlayDurations: string[];
} {
  const lastTick = replay.ticks.ticks[replay.ticks.frameCount - 1] ?? 0;
  const overlay = (replay.blinds ?? []).filter((b) => b.duration >= FLASH_OVERLAY_SPIKE_SECONDS);
  const world = (replay.kills ?? []).filter((k) => k.attacker < 0);
  const bots = replay.players.filter((p) => p.is_bot);
  const snaps = replay.controllerDump ?? [];
  return {
    players: replay.players.map((p) => ({
      name: p.name,
      steam: p.steam_id,
      start: p.start_side,
      is_bot: p.is_bot,
    })),
    presentAtEnd: presentAt(replay, lastTick),
    botCount: bots.length,
    botIds: bots.map((p) => p.steam_id),
    worldKills: world.length,
    worldKillTicks: world.slice(0, 12).map((k) => k.tick),
    controllers: snaps.filter((row) => !row.at_freeze).map(dumpController),
    fillFreeze: snaps.filter((row) => row.at_freeze).map(dumpController),
    rounds: replay.rounds
      .filter((r) => !r.is_knife)
      .map((r) => ({
        n: r.number,
        present: presentAt(replay, r.freeze_end_tick || r.start_tick),
      })),
    blinds: replay.blinds?.length ?? 0,
    overlayBlinds: overlay.length,
    overlayDurations: [...new Set(overlay.map((b) => b.duration.toFixed(2)))].sort(),
  };
}

function dumpController(row: ControllerDump): ParseDumpController {
  return {
    tick: row.tick,
    slot: row.slot,
    name: row.name,
    steam: row.steam,
    isBot: row.is_bot,
    connected: row.connected,
    pawn: row.has_team_pawn,
    assigned: row.assigned,
  };
}

function presentAt(replay: Replay, tick: number): ParseDumpPresent[] {
  return samplePlayers(replay, tick)
    .filter((p) => p.present)
    .map((p) => {
      const meta = replay.players[p.index];
      return {
        name: playerLabel(meta),
        steam: meta?.steam_id ?? 0,
        is_bot: meta?.is_bot ?? false,
        alive: p.alive,
        money: p.money,
        ct: p.ct,
      };
    });
}
