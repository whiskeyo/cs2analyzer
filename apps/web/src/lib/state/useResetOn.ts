import { useState } from "react";

/** Nothing a caller can pass, so the first render always counts as a change. */
const UNSEEN = Symbol("unseen");

/**
 * Runs `reset` during render on mount and whenever `key` changes, React's
 * documented way to adjust state when a prop changes. An effect would render
 * the stale state once first, which for the viewer means a frame of the
 * previous demo.
 *
 * Mount counts as a change so a store mounted straight onto a loaded demo
 * behaves the same as one that saw the demo arrive.
 */
export function useResetOn(key: unknown, reset: () => void): void {
  const [seen, setSeen] = useState<unknown>(UNSEEN);
  if (seen !== key) {
    setSeen(key);
    reset();
  }
}
