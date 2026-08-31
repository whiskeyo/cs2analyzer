import { useLayoutEffect, useRef } from "react";

/**
 * Runs `reset` in a layout effect when `demoId` changes to a new non-null id.
 * Skips while `enabled` is false (e.g. until the new demo's replay is loaded).
 *
 * useLayoutEffect avoids a frame of the previous demo and render-phase setState
 * storms when several stores reset together during series file switches.
 */
export function useResetOnDemoChange(
  demoId: string | null,
  reset: () => void,
  enabled = true,
): void {
  const prevRef = useRef<string | null>(null);
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useLayoutEffect(() => {
    if (!enabled || !demoId) {
      prevRef.current = null;
      return;
    }
    if (prevRef.current === demoId) {
      return;
    }
    prevRef.current = demoId;
    resetRef.current();
  }, [demoId, enabled]);
}
