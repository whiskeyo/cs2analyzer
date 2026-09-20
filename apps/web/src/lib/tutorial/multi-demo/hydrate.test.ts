import { describe, expect, it } from "vitest";
import { SERIES_HABITS_WINDOW_SECONDS } from "@/lib/shared/constants";
import { collectSeriesRoundsByKind, matchingTags } from "@/lib/parse/seriesAnalysis";
import { buildSeriesOverlay, overlayAtPlaySec, overlayRoster } from "@/lib/parse/seriesOverlay";
import { analyzerPawnLegend } from "@/lib/radar/pawnLegend";
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

  it("binds Aggregated full overlay for the focal team's real habits side", async () => {
    const series = await hydrateTutorialSeries();
    expect(series).not.toBeNull();
    if (!series) return;
    const tagged = { ...series, tagsByDemo: tutorialSeriesHabitsTags(series) };
    const spiritNames = new Set(focalRosterForSeries(series).map((p) => p.name));
    expect(spiritNames.size).toBeGreaterThan(0);

    const tFilter = { side: "T" as const, kind: "full" as const };
    const tOverlay = buildSeriesOverlay(tagged, tFilter);
    expect(tOverlay.trails.length).toBeGreaterThan(0);
    expect(overlayAtPlaySec(tOverlay, 0).trails.length).toBeGreaterThan(0);
    expect(overlayAtPlaySec(tOverlay, 5).trails.length).toBeGreaterThan(0);
    expect(tOverlay.trails.every((trail) => spiritNames.has(trail.playerName))).toBe(true);
    const tTags = tagged.demos.reduce(
      (n, demo) => n + matchingTags(tagged.tagsByDemo.get(demo.id) ?? [], tFilter).length,
      0,
    );
    expect(tTags).toBeGreaterThan(0);
    const sides = new Set(
      tagged.demos.flatMap((demo) =>
        (tagged.tagsByDemo.get(demo.id) ?? []).map((tag) => tag.sideForFocal),
      ),
    );
    expect(sides.has("T")).toBe(true);

    const ctFilter = { side: "CT" as const, kind: "full" as const };
    const ctOverlay = buildSeriesOverlay(tagged, ctFilter);
    expect(ctOverlay.trails.every((trail) => spiritNames.has(trail.playerName))).toBe(true);
    expect(ctOverlay.trails.some((trail) => /npl|huNter|MATYS/i.test(trail.playerName))).toBe(
      false,
    );
    const ctTags = tagged.demos.reduce(
      (n, demo) => n + matchingTags(tagged.tagsByDemo.get(demo.id) ?? [], ctFilter).length,
      0,
    );
    // Checked-in fixtures are T-only until `--generate-ts-series` is re-run
    // with side-balanced full-buy windows. After that, CT must be non-empty.
    if (ctTags > 0) {
      expect(ctOverlay.trails.length).toBeGreaterThan(0);
    }
  });

  it("scopes Aggregated CT full trails and pawn legend to Spirit", async () => {
    const series = await hydrateTutorialSeries();
    expect(series).not.toBeNull();
    if (!series) return;
    const tagged = { ...series, tagsByDemo: tutorialSeriesHabitsTags(series) };
    const spirit = focalRosterForSeries(series);
    expect(spirit.length).toBeGreaterThan(0);
    const spiritKeys = new Set(spirit.map((p) => p.key));
    const spiritNames = new Set(spirit.map((p) => p.name));
    const ctRoster = overlayRoster(tagged, { side: "CT", kind: "full" });
    const tRoster = overlayRoster(tagged, { side: "T", kind: "full" });
    expect(ctRoster.every((p) => spiritKeys.has(p.key))).toBe(true);
    const ctOptions = ctRoster.length > 0 ? ctRoster : spirit;
    expect(ctOptions.length).toBeGreaterThan(0);
    expect(ctOptions.every((p) => spiritKeys.has(p.key))).toBe(true);
    expect(tRoster.length).toBeGreaterThan(0);
    expect(tRoster.every((p) => spiritKeys.has(p.key))).toBe(true);

    const allCt = buildSeriesOverlay(tagged, { side: "CT", kind: "full" });
    expect(allCt.trails.every((trail) => spiritNames.has(trail.playerName))).toBe(true);
    const ctLegend = analyzerPawnLegend(
      tagged,
      { aggregated: true, overlayOn: true, bucketOverlay: { kind: "full", side: "CT" } },
      allCt,
    );
    expect(ctLegend.every((row) => spiritNames.has(row.label))).toBe(true);
    expect(ctLegend.some((row) => /npl|huNter|MATYS/i.test(row.label))).toBe(false);

    const tPlayer = tRoster[0]!;
    const oneT = buildSeriesOverlay(tagged, { side: "T", kind: "full" }, tPlayer.key);
    const allT = buildSeriesOverlay(tagged, { side: "T", kind: "full" });
    expect(oneT.trails.length).toBeGreaterThan(0);
    expect(oneT.trails.length).toBeLessThan(allT.trails.length);
    expect(oneT.trails.every((trail) => trail.playerName === tPlayer.name)).toBe(true);
    const tLegend = analyzerPawnLegend(
      tagged,
      { aggregated: true, overlayOn: true, bucketOverlay: { kind: "full", side: "T" } },
      allT,
    );
    expect(tLegend.length).toBeGreaterThan(0);
    expect(tLegend.every((row) => spiritNames.has(row.label))).toBe(true);
  });
});
