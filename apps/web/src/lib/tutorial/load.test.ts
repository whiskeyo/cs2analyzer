import { describe, expect, it } from "vitest";
import {
  isTutorialSeriesReady,
  loadTutorialPlaybook,
  loadTutorialReplay,
  loadTutorialSeries,
  resetTutorialLoadCache,
} from "./load";

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
  });

  it("reuses the cached series hydrate promise", async () => {
    resetTutorialLoadCache();
    expect(isTutorialSeriesReady()).toBe(false);
    const first = loadTutorialSeries();
    const second = loadTutorialSeries();
    expect(second).toBe(first);
    expect(isTutorialSeriesReady()).toBe(false);
    const series = await first;
    expect(await second).toBe(series);
    expect(isTutorialSeriesReady()).toBe(true);
    expect(loadTutorialSeries()).toBe(first);
  });
});
