import { describe, expect, it } from "vitest";
import { makeGrenade, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { tagRounds } from "./roundTags";
import { aggregateSeriesUtil, matchingTags } from "./seriesAnalysis";

describe("matchingTags", () => {
  const tags = [
    {
      demoId: "a",
      roundNumber: 1,
      startTick: 0,
      freezeEndTick: 64,
      sideForFocal: "CT" as const,
      kind: "pistol" as const,
      isOt: false,
    },
    {
      demoId: "a",
      roundNumber: 2,
      startTick: 1000,
      freezeEndTick: 1064,
      sideForFocal: "CT" as const,
      kind: "full" as const,
      isOt: false,
    },
  ];

  it("filters by side and kind", () => {
    expect(matchingTags(tags, { side: "CT", kind: "full" })).toHaveLength(1);
    expect(matchingTags(tags, { kind: "pistol" })[0].roundNumber).toBe(1);
  });
});

describe("aggregateSeriesUtil", () => {
  it("counts util across tagged rounds in the bucket", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B", map_name: "de_mirage" },
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
        }),
        makeRound({
          number: 2,
          team_ct: focal,
          team_t: "B",
          start_tick: 800,
          freeze_end_tick: 864,
          end_tick: 1500,
        }),
      ],
      grenades: [
        makeGrenade({ kind: "smoke", start_tick: 100, thrower: 0 }),
        makeGrenade({ kind: "smoke", start_tick: 900, thrower: 0 }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo]);
    const tagsByDemo = new Map([[demo.id, tagRounds(replay, demo.id, focal)]]);
    const fullCt = aggregateSeriesUtil(series, tagsByDemo, { side: "CT", kind: "full" }, null);
    expect(fullCt.roundCount).toBe(0);
    const pistol = aggregateSeriesUtil(series, tagsByDemo, { side: "CT", kind: "pistol" }, null);
    expect(pistol.roundCount).toBe(1);
    expect(pistol.entries.reduce((n, e) => n + e.count, 0)).toBe(1);
  });
});

describe("buildSeriesTags", () => {
  it("tags every demo in a series", () => {
    const focal = "Alpha";
    const a = loadedDemo(
      makeReplay({ header: { team_ct: focal, team_t: "Bravo" } }),
      "a.dem",
      new File([], "a.dem"),
    );
    const series = buildSeries("de_mirage", [a]);
    expect(series.tagsByDemo.get(a.id)?.length).toBeGreaterThan(0);
  });
});
