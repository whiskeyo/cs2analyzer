import { describe, expect, it } from "vitest";
import { SERIES_HABITS_WINDOW_SECONDS } from "@/lib/shared/constants";
import { collectSeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import { hydrateTutorialSeries } from "./hydrate";
import { tutorialSeriesManifest } from "./manifest";
import { isTutorialSeriesActiveRound, tutorialSeriesDemoId } from "./types";
import { loadTutorialSeries } from "../load";

describe("tutorial multi-demo fixture", () => {
  it("ships a same-map manifest with habits-window metadata", () => {
    expect(tutorialSeriesManifest.mapName).toBe("de_mirage");
    expect(tutorialSeriesManifest.habitsWindowSec).toBe(SERIES_HABITS_WINDOW_SECONDS);
    expect(tutorialSeriesManifest.matches).toHaveLength(5);
    expect(new Set(tutorialSeriesManifest.matches.map((m) => m.mapName)).size).toBe(1);
    const first = tutorialSeriesManifest.matches[0];
    expect(tutorialSeriesDemoId(first)).toBe(`tutorial-series|${first.mapName}|${first.id}`);
    expect(isTutorialSeriesActiveRound(first, 1)).toBe(false);
  });

  it("hydrates a DemoSeries the Aggregated view can consume", async () => {
    const series = await hydrateTutorialSeries();
    expect(series).not.toBeNull();
    if (!series) return;
    expect(series.mapName).toBe(tutorialSeriesManifest.mapName);
    expect(series.demos).toHaveLength(tutorialSeriesManifest.matches.length);
    for (const demo of series.demos) {
      expect(demo.id.startsWith("tutorial-series|")).toBe(true);
      expect(demo.file.size).toBe(0);
      const { ticks } = demo.replay;
      const n = ticks.frameCount * ticks.playerCount;
      expect(ticks.x).toBeInstanceOf(Float32Array);
      expect(ticks.x.length).toBe(n);
      expect(ticks.ticks.length).toBe(ticks.frameCount);
    }
    expect(collectSeriesRoundsByKind(series).every((group) => group.rounds.length === 0)).toBe(
      true,
    );
  });

  it("lazy-loads through loadTutorialSeries", async () => {
    const series = await loadTutorialSeries();
    expect(series?.demos.length).toBe(5);
  });
});
