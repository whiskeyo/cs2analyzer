import { loadTutorialPlaybook, loadTutorialReplay, loadTutorialSeries } from "./load";
import type { TutorialStep } from "./query";

/**
 * Home idle prefetch fallback / `requestIdleCallback` timeout so first paint
 * is never blocked waiting for the Replay chunk.
 */
export const TUTORIAL_HOME_PREFETCH_TIMEOUT_MS = 1200;

type NavigatorConnection = { saveData?: boolean };

function navigatorConnection(): NavigatorConnection | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NavigatorConnection }).connection;
}

export function prefersSaveData(): boolean {
  return navigatorConnection()?.saveData === true;
}

function scheduleIdle(run: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: TUTORIAL_HOME_PREFETCH_TIMEOUT_MS });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, TUTORIAL_HOME_PREFETCH_TIMEOUT_MS);
  return () => window.clearTimeout(id);
}

/** Warm the Replay fixture after idle. No-op on Save-Data. */
export function prefetchTutorialReplay(): void {
  if (prefersSaveData()) return;
  void loadTutorialReplay();
}

export function prefetchTutorialSeries(): void {
  void loadTutorialSeries();
}

export function prefetchTutorialPlaybook(): void {
  void loadTutorialPlaybook();
}

/**
 * Home-only: wait for idle (or a short timeout) then pull the Replay chunk.
 * Caller must skip when `tutorialCompleted` is already true.
 */
export function scheduleHomeTutorialPrefetch(): () => void {
  if (prefersSaveData()) return () => {};
  return scheduleIdle(() => {
    prefetchTutorialReplay();
  });
}

/** Warm the next step while the current one is on screen. */
export function prefetchNextTutorialStep(step: TutorialStep): void {
  if (step === "replay") prefetchTutorialSeries();
  else if (step === "aggregated") prefetchTutorialPlaybook();
}
