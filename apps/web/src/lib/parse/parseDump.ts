import { FLASH_OVERLAY_SPIKE_SECONDS } from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";

/** Compact parse dump so a re-drop can prove what WASM actually emitted. */
export function parseDump(replay: Replay): {
  players: { name: string; steam: number; start: string }[];
  presentAtEnd: { name: string; steam: number; alive: boolean; money: number; ct: boolean }[];
  blinds: number;
  overlayBlinds: number;
  overlayDurations: string[];
} {
  const lastTick = replay.ticks.ticks[replay.ticks.frameCount - 1] ?? 0;
  const snap = samplePlayers(replay, lastTick);
  const overlay = (replay.blinds ?? []).filter((b) => b.duration >= FLASH_OVERLAY_SPIKE_SECONDS);
  return {
    players: replay.players.map((p) => ({ name: p.name, steam: p.steam_id, start: p.start_side })),
    presentAtEnd: snap
      .filter((p) => p.present)
      .map((p) => ({
        name: replay.players[p.index]?.name ?? "?",
        steam: replay.players[p.index]?.steam_id ?? 0,
        alive: p.alive,
        money: p.money,
        ct: p.ct,
      })),
    blinds: replay.blinds?.length ?? 0,
    overlayBlinds: overlay.length,
    overlayDurations: [...new Set(overlay.map((b) => b.duration.toFixed(2)))].sort(),
  };
}
