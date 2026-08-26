import { RADAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "./constants";

export const SIDEBAR_WIDTH_STORAGE_KEY = "cs2analyzer.sidebarWidth";

export function clampSidebarWidth(width: number, stageWidth: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_MIN_WIDTH;
  const room = stageWidth - RADAR_MIN_WIDTH;
  const max = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, room));
  return Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

export function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw == null) return SIDEBAR_MIN_WIDTH;
    return clampSidebarWidth(Number(raw), Number.POSITIVE_INFINITY);
  } catch {
    return SIDEBAR_MIN_WIDTH;
  }
}

export function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(clampSidebarWidth(width, Number.POSITIVE_INFINITY)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
