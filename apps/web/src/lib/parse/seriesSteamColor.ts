/** Stable habit-trail color from a Steam ID (nicknames and stand-ins change). */
export function steamColor(steamId: number): string {
  if (steamId <= 0) return "rgba(180, 180, 180, 0.55)";
  let hash = steamId >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  const hue = hash % 360;
  return `hsla(${hue}, 72%, 58%, 0.62)`;
}
