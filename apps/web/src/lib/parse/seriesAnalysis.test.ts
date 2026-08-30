import { describe, expect, it } from "vitest";
import { makeFreezeTicks, makeGrenade, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { tagRounds } from "./roundTags";
import {
  aggregateSeriesUtil,
  calloutsForUtilRow,
  collectSeriesRoundsByKind,
  matchingTags,
  seriesActionLabel,
} from "./seriesAnalysis";
import type { ExecuteBeat } from "@/lib/match/execute";

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
      ticks: makeFreezeTicks(2, 1, 64),
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

describe("collectSeriesRoundsByKind", () => {
  it("groups focal rounds by buy type with per-bucket indices", () => {
    const focal = "Team A";
    const replayA = makeReplay({
      header: { team_ct: focal, team_t: "B", map_name: "de_mirage" },
      ticks: makeFreezeTicks(2, 1, 64),
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
    });
    const replayB = makeReplay({
      header: { team_ct: "B", team_t: focal, map_name: "de_mirage" },
      ticks: makeFreezeTicks(2, 1, 64),
      rounds: [
        makeRound({
          number: 1,
          team_ct: "B",
          team_t: focal,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
        }),
      ],
    });
    const demoA = loadedDemo(replayA, "a.dem", new File([], "a.dem"));
    const demoB = loadedDemo(replayB, "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_mirage", [demoA, demoB]);
    const groups = collectSeriesRoundsByKind(series);
    const pistol = groups.find((g) => g.kind === "pistol");
    expect(pistol?.rounds).toHaveLength(2);
    expect(pistol?.rounds.map((r) => r.side)).toEqual(["CT", "T"]);
    expect(pistol?.rounds.map((r) => r.indexInKind)).toEqual([1, 1]);
    expect(pistol?.rounds[0].demoId).toBe(demoA.id);
    expect(pistol?.rounds[1].demoId).toBe(demoB.id);
  });

  it("keeps CT and T blocks separate with per-side indices", () => {
    const focal = "Team A";
    const replayCt = makeReplay({
      header: { team_ct: focal, team_t: "B", map_name: "de_mirage" },
      ticks: makeFreezeTicks(2, 1, 64),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
        }),
      ],
    });
    const replayCt2 = makeReplay({
      header: { team_ct: focal, team_t: "C", map_name: "de_mirage" },
      ticks: makeFreezeTicks(2, 1, 64),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "C",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
        }),
      ],
    });
    const replayT = makeReplay({
      header: { team_ct: "B", team_t: focal, map_name: "de_mirage" },
      ticks: makeFreezeTicks(2, 1, 64),
      rounds: [
        makeRound({
          number: 1,
          team_ct: "B",
          team_t: focal,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
        }),
      ],
    });
    const demoCt = loadedDemo(replayCt, "a.dem", new File([], "a.dem"));
    const demoCt2 = loadedDemo(replayCt2, "b.dem", new File([], "b.dem"));
    const demoT = loadedDemo(replayT, "c.dem", new File([], "c.dem"));
    const series = buildSeries("de_mirage", [demoCt, demoCt2, demoT]);
    const pistol = collectSeriesRoundsByKind(series).find((g) => g.kind === "pistol");
    expect(pistol?.rounds.map((r) => [r.side, r.indexInKind])).toEqual([
      ["CT", 1],
      ["CT", 2],
      ["T", 1],
    ]);
  });
});

describe("seriesActionLabel", () => {
  it("lists direct callouts instead of a single site label", () => {
    const beat = {
      title: "T execute · A",
      location: "between Palace, Apps",
      site: "A",
    } as ExecuteBeat;
    expect(seriesActionLabel(beat)).toBe("T execute · Palace, Apps");
  });
});

describe("calloutsForUtilRow", () => {
  it("expands between-callout locations", () => {
    expect(
      calloutsForUtilRow({
        location: "between Palace, Apps",
        site: "A",
      } as never),
    ).toEqual(["Palace", "Apps"]);
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
