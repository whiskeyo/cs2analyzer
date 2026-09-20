import { describe, expect, it } from "vitest";
import { SERIES_HABITS_WINDOW_SECONDS } from "@/lib/shared/constants";
import { collectSeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import { buildSeriesOverlay, overlayAtPlaySec, overlayRoster } from "@/lib/parse/seriesOverlay";
import { matchingTags } from "@/lib/parse/seriesAnalysis";
import { focalRosterForSeries } from "@/lib/parse/seriesRoster";
import { hydrateTutorialSeries } from "./hydrate";
import { tutorialSeriesManifest } from "./manifest";
import { isTutorialSeriesActiveRound, tutorialSeriesDemoId } from "./types";
import { tutorialSeriesHabitsTags } from "../activeRound";
import { loadTutorialSeries } from "../load";

describe("tutorial multi-demo fixture", () => {
  it("ships a same-map manifest with habits-window metadata", () => {
    expect(tutorialSeriesManifest.mapName.length).toBeGreaterThan(0);
    expect(tutorialSeriesManifest.habitsWindowSec).toBe(SERIES_HABITS_WINDOW_SECONDS);
    expect(tutorialSeriesManifest.matches.length).toBeGreaterThan(0);
    expect(new Set(tutorialSeriesManifest.matches.map((m) => m.mapName)).size).toBe(1);
    const first = tutorialSeriesManifest.matches[0];
    expect(tutorialSeriesDemoId(first)).toBe(`tutorial-series|${first.mapName}|${first.id}`);
    expect(isTutorialSeriesActiveRound(first, 1)).toBe(first.activeRounds.includes(1));
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
    expect(Array.isArray(collectSeriesRoundsByKind(series))).toBe(true);
    const chips = collectSeriesRoundsByKind(series).flatMap((group) => group.rounds);
    const activeCap = tutorialSeriesManifest.matches.reduce(
      (n, meta) => n + meta.activeRounds.length,
      0,
    );
    expect(chips.length).toBeGreaterThan(activeCap);
  });

  it("lazy-loads through loadTutorialSeries", async () => {
    const series = await loadTutorialSeries();
    expect(series?.demos.length).toBe(tutorialSeriesManifest.matches.length);
  });

  it("binds Aggregated full overlay for both CT and T habits windows", async () => {
    const series = await hydrateTutorialSeries();
    expect(series).not.toBeNull();
    if (!series) return;
    const tagged = { ...series, tagsByDemo: tutorialSeriesHabitsTags(series) };
    for (const side of ["CT", "T"] as const) {
      const filter = { side, kind: "full" as const };
      const overlay = buildSeriesOverlay(tagged, filter);
      expect(overlay.trails.length).toBeGreaterThan(0);
      expect(overlayAtPlaySec(overlay, 0).trails.length).toBeGreaterThan(0);
      expect(overlayAtPlaySec(overlay, 5).trails.length).toBeGreaterThan(0);
      const tagCount = tagged.demos.reduce(
        (n, demo) => n + matchingTags(tagged.tagsByDemo.get(demo.id) ?? [], filter).length,
        0,
      );
      expect(tagCount).toBeGreaterThan(0);
    }
  });

  it("filters CT overlay players independently of the focal T roster", async () => {
    const series = await hydrateTutorialSeries();
    expect(series).not.toBeNull();
    if (!series) return;
    const tagged = { ...series, tagsByDemo: tutorialSeriesHabitsTags(series) };
    const ctRoster = overlayRoster(tagged, { side: "CT", kind: "full" });
    const tRoster = overlayRoster(tagged, { side: "T", kind: "full" });
    const focal = focalRosterForSeries(series);
    expect(ctRoster.length).toBeGreaterThan(0);
    expect(tRoster.length).toBeGreaterThan(0);
    expect(ctRoster.some((p) => focal.every((row) => row.key !== p.key))).toBe(true);
    const ctPlayer = ctRoster[0]!;
    const allCt = buildSeriesOverlay(tagged, { side: "CT", kind: "full" });
    const oneCt = buildSeriesOverlay(tagged, { side: "CT", kind: "full" }, ctPlayer.key);
    expect(oneCt.trails.length).toBeGreaterThan(0);
    expect(oneCt.trails.length).toBeLessThan(allCt.trails.length);
    expect(oneCt.trails.every((trail) => trail.playerName === ctPlayer.name)).toBe(true);
  });
});
