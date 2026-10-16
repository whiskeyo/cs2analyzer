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
