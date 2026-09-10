import {
  RADAR_MIN_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "./constants";
import { SIDEBAR_WIDTH_STORAGE_KEY } from "./storageKeys";

export { SIDEBAR_WIDTH_STORAGE_KEY } from "./storageKeys";

export function clampPanelWidth(
  width: number,
  stageWidth: number,
  minWidth: number,
  maxWidth: number,
  reserved = RADAR_MIN_WIDTH,
): number {
  if (!Number.isFinite(width)) return minWidth;
  const room = stageWidth - reserved;
  const max = Math.min(maxWidth, Math.max(minWidth, room));
  return Math.min(max, Math.max(minWidth, Math.round(width)));
}

export function clampSidebarWidth(width: number, stageWidth: number): number {
  return clampPanelWidth(width, stageWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
}

export function loadPanelWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) {
      return clampPanelWidth(defaultWidth, Number.POSITIVE_INFINITY, minWidth, maxWidth);
    }
    return clampPanelWidth(Number(raw), Number.POSITIVE_INFINITY, minWidth, maxWidth);
  } catch {
    return defaultWidth;
  }
}

export function savePanelWidth(
  storageKey: string,
  width: number,
  minWidth: number,
  maxWidth: number,
): void {
  try {
    localStorage.setItem(
      storageKey,
      String(clampPanelWidth(width, Number.POSITIVE_INFINITY, minWidth, maxWidth)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadSidebarWidth(): number {
  return loadPanelWidth(
    SIDEBAR_WIDTH_STORAGE_KEY,
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH,
  );
}

export function saveSidebarWidth(width: number): void {
  savePanelWidth(SIDEBAR_WIDTH_STORAGE_KEY, width, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
}
