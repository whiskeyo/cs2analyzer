export interface ColorPreset {
  id: string;
  label: string;
  colors: readonly [string, string, string, string, string];
}

/** Four swatch sets. Saturated so they read on tan radars. */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  {
    id: "neon",
    label: "Neon",
    colors: ["#ff2d6a", "#ffe600", "#00f0ff", "#3dff6e", "#ffffff"],
  },
  {
    id: "heat",
    label: "Heat",
    colors: ["#ff1f1f", "#ff7a00", "#ffef00", "#ff3d8a", "#ffffff"],
  },
  {
    id: "night",
    label: "Night",
    colors: ["#b04cff", "#00d4ff", "#ff4ad4", "#5cff9a", "#f4f7ff"],
  },
  {
    id: "mark",
    label: "Mark",
    colors: ["#ff1744", "#2979ff", "#00e676", "#ffea00", "#ffffff"],
  },
];

/**
 * Unique overlay pawn tints (Aggregated trails + Playbook snapshot legend).
 * First five: red, green, yellow, blue, brown. Later slots stay equally spaced
 * hues — not near-duplicates of those five or of each other.
 */
export const PLAYER_TINTS: readonly string[] = [
  "#d62728",
  "#2ca02c",
  "#ffe83a",
  "#1f77b4",
  "#8c564b",
  "#9467bd",
  "#ff7f0e",
  "#17becf",
  "#e377c2",
  "#bcbd22",
];

/** Unknown / missing Steam ID — not a roster slot. */
export const UNKNOWN_STEAM_TINT = "rgba(180, 180, 180, 0.55)";

/** Next unused palette colour for `key`, stable for the life of `assigned`. */
export function uniqueTint(key: string, assigned: Map<string, string>): string {
  const existing = assigned.get(key);
  if (existing) return existing;
  const color = PLAYER_TINTS[assigned.size % PLAYER_TINTS.length] ?? PLAYER_TINTS[0] ?? "#d62728";
  assigned.set(key, color);
  return color;
}

/** Stable colour for a player name within one snapshot. */
export function tintForName(name: string, assigned: Map<string, string>): string {
  const key = name.trim().toLowerCase() || "?";
  return uniqueTint(key, assigned);
}
