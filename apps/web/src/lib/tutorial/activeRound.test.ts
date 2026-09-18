import { describe, expect, it } from "vitest";
import { TUTORIAL_ID } from "./identity";
import { tutorialSeriesManifest } from "./multi-demo/manifest";
import { tutorialSeriesDemoId } from "./multi-demo/types";
import {
  isTutorialSeriesActiveRound,
  isTutorialSeriesRoundEnabled,
  tutorialSeriesMetaForDemoId,
} from "./activeRound";

describe("tutorial series round greying", () => {
  it("enables every round on a non-series (or missing) demo id", () => {
    expect(isTutorialSeriesRoundEnabled(undefined, 12)).toBe(true);
    expect(isTutorialSeriesRoundEnabled("de_mirage|match.dem", 12)).toBe(true);
    expect(isTutorialSeriesRoundEnabled(TUTORIAL_ID, 2)).toBe(true);
  });

  it("uses isTutorialSeriesActiveRound for habits-window rounds only", () => {
    const meta = tutorialSeriesManifest.matches[0];
    const demoId = tutorialSeriesDemoId(meta);
    expect(tutorialSeriesMetaForDemoId(demoId)).toEqual(meta);
    expect(meta.activeRounds).toEqual([1, 2]);
    expect(isTutorialSeriesActiveRound(meta, 1)).toBe(true);
    expect(isTutorialSeriesActiveRound(meta, 2)).toBe(true);
    expect(isTutorialSeriesActiveRound(meta, 3)).toBe(false);
    expect(isTutorialSeriesRoundEnabled(demoId, 1)).toBe(true);
    expect(isTutorialSeriesRoundEnabled(demoId, 2)).toBe(true);
    expect(isTutorialSeriesRoundEnabled(demoId, 3)).toBe(false);
    expect(isTutorialSeriesRoundEnabled(demoId, 0)).toBe(false);
  });
});
