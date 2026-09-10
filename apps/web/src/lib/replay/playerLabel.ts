import type { Player, Replay } from "@/lib/replay/replayTypes";

/** Scoreboard / radar / feed label. Bots keep their GOTV name plus a BOT tag. */
export function playerLabel(player: Player | undefined, missing = "?"): string {
  if (!player) return missing;
  const name = player.name.trim();
  if (player.is_bot) {
    return name ? `${name} (BOT)` : "BOT";
  }
  return name || missing;
}

/** Kill-feed / review attacker: World when the index is missing. */
export function attackerLabel(replay: Replay, index: number): string {
  if (index < 0) return "World";
  return playerLabel(replay.players[index], "?");
}
