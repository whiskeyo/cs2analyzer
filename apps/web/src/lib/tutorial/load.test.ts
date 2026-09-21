import { describe, expect, it, vi } from "vitest";
import {
  isTutorialSeriesReady,
  loadTutorialPlaybook,
  loadTutorialReplay,
  loadTutorialSeries,
  peekTutorialSeries,
  prefetchTutorialSeriesChunks,
  resetTutorialLoadCache,
} from "./load";
import { seriesMatchLoaders } from "./multi-demo/loaders";
import { TUTORIAL_PLAYBOOK_TITLE, tutorialPlaybookKey } from "./playbook/constants";

describe("tutorial load entry", () => {
  it("lazy-loads the three fixture loaders", async () => {
    resetTutorialLoadCache();
    const replay = await loadTutorialReplay();
    const series = await loadTutorialSeries();
    const books = await loadTutorialPlaybook();
    expect(replay.header.map_name).toBe("de_mirage");
    expect(replay.rounds).toHaveLength(2);
    expect(series).not.toBeNull();
    expect(series?.demos.length).toBeGreaterThan(1);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      key: tutorialPlaybookKey("de_mirage"),
      title: TUTORIAL_PLAYBOOK_TITLE,
      mapName: "de_mirage",
    });
    expect(books[0]?.pages).toHaveLength(1);
    expect(books[0]?.pages[0]?.title).toBe("Fake A Smokes, B contact");
  });

  it("reuses the cached series hydrate promise", async () => {
    resetTutorialLoadCache();
    expect(isTutorialSeriesReady()).toBe(false);
    expect(peekTutorialSeries()).toBeNull();
    const first = loadTutorialSeries();
    const second = loadTutorialSeries();
    expect(second).toBe(first);
    expect(isTutorialSeriesReady()).toBe(false);
    const series = await first;
    expect(await second).toBe(series);
    expect(isTutorialSeriesReady()).toBe(true);
    expect(peekTutorialSeries()).toBe(series);
    expect(loadTutorialSeries()).toBe(first);
    resetTutorialLoadCache();
    expect(peekTutorialSeries()).toBeNull();
    expect(isTutorialSeriesReady()).toBe(false);
  });

  it("starts split match payload imports before series hydrate resolves", () => {
    const originals = { ...seriesMatchLoaders };
    const spies = Object.keys(originals).map((id) => {
      const spy = vi.fn(originals[id]);
      seriesMatchLoaders[id] = spy;
      return spy;
    });
    try {
      expect(spies.length).toBeGreaterThan(1);
      prefetchTutorialSeriesChunks();
      for (const spy of spies) {
        expect(spy).toHaveBeenCalledOnce();
      }
    } finally {
      Object.assign(seriesMatchLoaders, originals);
    }
  });
});
