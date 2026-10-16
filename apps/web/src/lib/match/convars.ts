import type { MatchInfo } from "@/lib/replay/replayTypes";

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
