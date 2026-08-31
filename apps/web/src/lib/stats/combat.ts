import type { Kill, Replay } from "@/lib/replay/replayTypes";
import { currentSide } from "./liveScore";

export function inKnifeRound(replay: Replay, tick: number): boolean {
  const r = replay.rounds.find((x) => tick >= x.start_tick && tick <= x.end_tick);
  return r?.is_knife ?? false;
}

export function isSuicide(k: Kill): boolean {
  if (k.attacker === k.victim) {
    return true;
  }
  if (k.attacker < 0) {
    return true;
  }
  const w = k.weapon.toLowerCase();
  return w === "world" || w === "suicide" || w.includes("trigger_hurt");
}

export function isEnemy(replay: Replay, a: number, b: number, tick: number): boolean {
  return a !== b && currentSide(replay, a, tick) !== currentSide(replay, b, tick);
}

export function isEnemyKill(replay: Replay, k: Kill): boolean {
  return k.attacker >= 0 && k.victim >= 0 && isEnemy(replay, k.attacker, k.victim, k.tick);
}
