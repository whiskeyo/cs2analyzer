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

describe("tutorial load entry", () => {
  it("lazy-loads the three fixture loaders", async () => {
    const replay = await loadTutorialReplay();
    const series = await loadTutorialSeries();
    const book = await loadTutorialPlaybook();
    expect(replay.header.map_name).toBe("de_mirage");
    expect(replay.rounds).toHaveLength(2);
    expect(series).not.toBeNull();
    expect(series?.demos.length).toBeGreaterThan(1);
    expect(book.title).toBe("Tutorial");
    expect(book.mapName).toBe("de_dust2");
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
