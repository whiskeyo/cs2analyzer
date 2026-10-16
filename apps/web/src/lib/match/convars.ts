import type { MatchInfo } from "@/lib/replay/replayTypes";
import { OVERTIME_START_MONEY } from "@/lib/shared/constants";

/** Demo key for the money each player receives at an overtime period start. */
const OVERTIME_START_MONEY_CONVAR = "mp_overtime_startmoney";

/**
 * Last value the server sent for `name`, or the tournament default when the
 * demo never sent it. Undefined when the name is in neither table, or when
 * this replay was parsed before `match_info` existed.
 */
export function getConvar(matchInfo: MatchInfo | undefined, name: string): string | undefined {
  if (matchInfo == null) return undefined;
  return matchInfo.convars.demo[name] ?? matchInfo.convars.defaults[name];
}

/**
 * Value of `name` at `tick`. The last `convar_updates` row for that name with
 * `tick` at or before the query wins. When nothing had been sent yet, this is
 * `getConvar` (the demo's final value, or the tournament default).
 */
export function getConvarAt(
  matchInfo: MatchInfo | undefined,
  name: string,
  tick: number,
): string | undefined {
  if (matchInfo == null) return undefined;
  let value: string | undefined;
  for (const update of matchInfo.convar_updates) {
    if (update.name !== name || update.tick > tick) continue;
    value = update.value;
  }
  return value ?? getConvar(matchInfo, name);
}

/**
 * Freeze money at the start of an overtime period.
 * The demo's `mp_overtime_startmoney` wins, then `observed.overtime_start_money`
 * when a later parser build recorded it, then the tournament default.
 * `observed` sits ahead of that default so a gamerules reading is kept when
 * the server never sent the convar.
 */
export function overtimeStartMoney(matchInfo: MatchInfo | undefined): number {
  const demo = wholeNumber(matchInfo?.convars.demo[OVERTIME_START_MONEY_CONVAR]);
  if (demo != null) return demo;
  const observed = matchInfo?.observed?.overtime_start_money;
  if (typeof observed === "number" && Number.isSafeInteger(observed) && observed >= 0) {
    return observed;
  }
  return OVERTIME_START_MONEY;
}

function wholeNumber(raw: string | undefined): number | undefined {
  if (raw == null || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return undefined;
  return value;
}
