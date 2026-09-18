import { tutorialSeriesManifest } from "./multi-demo/manifest";
import { isTutorialSeriesActiveRound, tutorialSeriesDemoId } from "./multi-demo/types";
import { TUTORIAL_SERIES_PREFIX } from "./identity";

export { isTutorialSeriesActiveRound };

export function tutorialSeriesMetaForDemoId(demoId: string | null | undefined) {
  if (!demoId?.startsWith(TUTORIAL_SERIES_PREFIX)) return undefined;
  return tutorialSeriesManifest.matches.find((meta) => tutorialSeriesDemoId(meta) === demoId);
}

/**
 * Round-strip hook: keep ordinary demos clickable; grey tutorial-series rounds
 * that sit outside the habits window (`activeRounds` in the manifest).
 */
export function isTutorialSeriesRoundEnabled(
  demoId: string | null | undefined,
  roundNumber: number,
): boolean {
  const meta = tutorialSeriesMetaForDemoId(demoId);
  if (!meta) return true;
  return isTutorialSeriesActiveRound(meta, roundNumber);
}
