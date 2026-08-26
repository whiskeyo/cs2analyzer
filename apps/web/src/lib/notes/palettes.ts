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
