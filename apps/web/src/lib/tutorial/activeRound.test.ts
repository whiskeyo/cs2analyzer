import { describe, expect, it } from "vitest";
import { TUTORIAL_ID } from "./identity";
import { tutorialSeriesManifest } from "./multi-demo/manifest";
import { tutorialSeriesDemoId } from "./multi-demo/types";
import {
  isTutorialSeriesActiveRound,
  isTutorialSeriesBucketEnabled,
  isTutorialSeriesChipEnabled,
  isTutorialSeriesRoundEnabled,
  isTutorialSeriesSession,
  tutorialSeriesMetaForDemoId,
} from "./activeRound";

describe("tutorial series round greying", () => {
  it("enables every round on a non-series (or missing) demo id", () => {
    expect(isTutorialSeriesRoundEnabled(undefined)).toBe(true);
    expect(isTutorialSeriesRoundEnabled("de_mirage|match.dem")).toBe(true);
    expect(isTutorialSeriesRoundEnabled(TUTORIAL_ID)).toBe(true);
    expect(isTutorialSeriesBucketEnabled("de_mirage|match.dem", "eco")).toBe(true);
    expect(isTutorialSeriesChipEnabled("de_mirage|match.dem")).toBe(true);
  });

  it("disables per-demo jumps; only Aggregated full stays interactive", () => {
    const meta = tutorialSeriesManifest.matches[0];
    const demoId = tutorialSeriesDemoId(meta);
    expect(tutorialSeriesMetaForDemoId(demoId)).toEqual(meta);
    expect(isTutorialSeriesSession(demoId)).toBe(true);
    expect(isTutorialSeriesActiveRound(meta, meta.activeRounds[0] ?? 1)).toBe(true);
    expect(isTutorialSeriesActiveRound(meta, 99)).toBe(false);
    expect(isTutorialSeriesRoundEnabled(demoId)).toBe(false);
    expect(isTutorialSeriesBucketEnabled(demoId, "full")).toBe(true);
    expect(isTutorialSeriesBucketEnabled(demoId, "pistol")).toBe(false);
    expect(isTutorialSeriesBucketEnabled(demoId, "eco")).toBe(false);
    expect(isTutorialSeriesBucketEnabled(demoId, "force")).toBe(false);
    expect(isTutorialSeriesChipEnabled(demoId)).toBe(false);
  });
});
