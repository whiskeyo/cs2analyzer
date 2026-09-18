import { describe, expect, it } from "vitest";
import {
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
    const first = loadTutorialSeries();
    const second = loadTutorialSeries();
    expect(second).toBe(first);
    const series = await first;
    expect(await second).toBe(series);
    expect(loadTutorialSeries()).toBe(first);
  });
});
