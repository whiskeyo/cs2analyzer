import { LAST_HIT_SECONDS, hitgroupLabel, tickRate } from "@/lib/shared/constants";
import { t } from "@/lib/i18n";
import type { Hurt, Replay } from "@/lib/replay/replayTypes";
import { isEnemy } from "./combat";

const MINUS = "\u2212";

/** Latest enemy hurt on `victim` still inside the spectator last-hit window. */
export function lastHitTaken(replay: Replay, tick: number, victim: number): Hurt | null {
  if (victim < 0) {
    return null;
  }
  const tps = tickRate(replay);
  if (tps <= 0) {
    return null;
  }
  const window = LAST_HIT_SECONDS * tps;
  let best: Hurt | null = null;
  for (const h of replay.hurts) {
    if (h.victim !== victim || h.damage <= 0) {
      continue;
    }
    if (h.attacker < 0 || h.attacker === victim) {
      continue;
    }
    if (!isEnemy(replay, h.attacker, victim, h.tick)) {
      continue;
    }
    const age = tick - h.tick;
    if (age < 0 || age > window) {
      continue;
    }
    if (!best || h.tick >= best.tick) {
      best = h;
    }
  }
  return best;
}

export function formatLastHitLocalized(
  h: Hurt | null,
  lastHit: string,
  lastHitArmor: string,
): string | null {
  if (!h) {
    return null;
  }
  const detail = `${hitgroupLabel(h.hitgroup)} ${MINUS}${h.damage}`;
  if (h.damage_armor > 0) {
    return t(lastHitArmor, { detail, armor: `${MINUS}${h.damage_armor}` });
  }
  return t(lastHit, { detail });
}

export function formatLastHit(h: Hurt | null): string | null {
  return formatLastHitLocalized(h, "Last hit: {detail}", "Last hit: {detail} (armor {armor})");
}
