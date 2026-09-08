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

/** Saturated player tints (palettes minus near-white). */
export const PLAYER_TINTS: readonly string[] = COLOR_PRESETS.flatMap((preset) =>
  preset.colors.filter((color) => {
    const hex = color.toLowerCase();
    return hex !== "#ffffff" && hex !== "#f4f7ff";
  }),
);

/** Stable colour for a player name within one snapshot. */
export function tintForName(name: string, assigned: Map<string, string>): string {
  const key = name.trim().toLowerCase() || "?";
  const existing = assigned.get(key);
  if (existing) return existing;
  const color = PLAYER_TINTS[assigned.size % PLAYER_TINTS.length] ?? PLAYER_TINTS[0] ?? "#ff2d6a";
  assigned.set(key, color);
  return color;
}
