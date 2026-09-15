import { UNKNOWN_STEAM_TINT, uniqueTint } from "@/lib/notes/palettes";

/** Unique overlay tint for a Steam ID within one Aggregated overlay. */
export function steamColor(steamId: number, assigned: Map<string, string>): string {
  if (steamId <= 0) return UNKNOWN_STEAM_TINT;
  return uniqueTint(String(steamId), assigned);
}
