import { useSyncExternalStore } from "react";
import { readDevicePixelRatio, watchDevicePixelRatio } from "@/lib/stats/timelineChart";

function subscribe(onStoreChange: () => void): () => void {
  return watchDevicePixelRatio(onStoreChange);
}

function serverDevicePixelRatio(): number {
  return 1;
}

/**
 * Live `devicePixelRatio`. `matchMedia('(resolution: Ndppx)')` only matches the
 * current ratio, so the watcher re-registers after each change. Zoom and a
 * monitor move update this without a sidebar resize.
 */
export function useDevicePixelRatio(): number {
  return useSyncExternalStore(subscribe, readDevicePixelRatio, serverDevicePixelRatio);
}
