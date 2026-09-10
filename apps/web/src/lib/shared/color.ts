/** Darken a #rrggbb color. Returns the input unchanged if it is not that shape. */
export function darkenHexColor(color: string, factor: number): string {
  if (!color.startsWith("#") || color.length !== 7) return color;
  const f = Math.max(0, Math.min(1, factor));
  const r = Math.round(parseInt(color.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(color.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(color.slice(5, 7), 16) * f);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;
}
