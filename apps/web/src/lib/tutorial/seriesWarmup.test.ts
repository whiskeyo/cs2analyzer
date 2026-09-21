/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeFreezeTicks, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { tutorialSeriesManifest } from "./multi-demo/manifest";
import { tutorialSeriesDemoId } from "./multi-demo/types";
import {
  ensureTutorialSeriesPrewarm,
  isTutorialSeriesOverlayReady,
  peekTutorialSeriesOverlay,
  peekTutorialTaggedSeries,
  resetTutorialSeriesWarmup,
  scheduleTutorialSeriesPrewarm,
} from "./seriesWarmup";

const FOCAL = "Team A";

function tutorialSeries() {
  const replay = makeReplay({
    header: { team_ct: FOCAL, team_t: "Enemy", map_name: "de_dust2" },
    players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "Enemy", 200)],
    ticks: makeFreezeTicks(2, 1, 64),
    rounds: [
      makeRound({
        number: 1,
        team_ct: FOCAL,
        team_t: "Enemy",
        start_tick: 0,
        freeze_end_tick: 64,
      }),
    ],
  });
  const a = loadedDemo(replay, "tutorial-series-0.dem", new File([], "tutorial-series-0.dem"));
  const b = loadedDemo(replay, "tutorial-series-1.dem", new File([], "tutorial-series-1.dem"));
  a.id = tutorialSeriesDemoId(tutorialSeriesManifest.matches[0]);
  b.id = tutorialSeriesDemoId(
    tutorialSeriesManifest.matches[1] ?? tutorialSeriesManifest.matches[0],
  );
  return buildSeries("de_dust2", [a, b], FOCAL);
}

describe("tutorial series warmup", () => {
  afterEach(() => {
    resetTutorialSeriesWarmup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("builds a reusable full overlay handle off the Next path", async () => {
    const series = tutorialSeries();
    expect(isTutorialSeriesOverlayReady()).toBe(false);
    expect(peekTutorialTaggedSeries(series)).toBeNull();

    await ensureTutorialSeriesPrewarm(series);

    expect(isTutorialSeriesOverlayReady()).toBe(true);
    const tagged = peekTutorialTaggedSeries(series);
    expect(tagged).not.toBeNull();
    const ct = peekTutorialSeriesOverlay(series, { side: "CT", kind: "full" }, null, 20);
    const t = peekTutorialSeriesOverlay(series, { side: "T", kind: "full" }, null, 20);
    expect(ct).not.toBeNull();
    expect(t).not.toBeNull();
    expect(ct).not.toBe(t);

    await ensureTutorialSeriesPrewarm(series);
    expect(peekTutorialSeriesOverlay(series, { side: "CT", kind: "full" }, null, 20)).toBe(ct);
  });

  it("defers overlay CPU until after the current paint", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const series = tutorialSeries();
    scheduleTutorialSeriesPrewarm(series);
    expect(isTutorialSeriesOverlayReady()).toBe(false);
    vi.runAllTimers();
    expect(isTutorialSeriesOverlayReady()).toBe(true);
    expect(
      peekTutorialSeriesOverlay(series, { side: "CT", kind: "full" }, null, 20),
    ).not.toBeNull();
  });

  it("flushes a pending paint-deferred prewarm when Aggregated navigation needs it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      window.setTimeout(() => cb(0), 50);
      return 1;
    });
    const series = tutorialSeries();
    scheduleTutorialSeriesPrewarm(series);
    expect(isTutorialSeriesOverlayReady()).toBe(false);

    await ensureTutorialSeriesPrewarm(series);

    expect(isTutorialSeriesOverlayReady()).toBe(true);
    expect(peekTutorialSeriesOverlay(series, { side: "T", kind: "full" }, null, 20)).not.toBeNull();
  });
});
