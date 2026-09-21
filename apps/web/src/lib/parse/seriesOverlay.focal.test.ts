import { describe, expect, it } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import {
  makeFreezeTicks,
  makeGrenade,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { analyzerPawnLegend } from "@/lib/radar/pawnLegend";
import { buildSeries, loadedDemo } from "./session";
import { buildSeriesOverlay, overlayRoster } from "./seriesOverlay";

describe("series overlay focal-team gate", () => {
  it("lists only the focal team on the selected side, not every CT/T pawn", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "Enemy" },
      players: [makePlayer(0, "CT", "A1", 100), makePlayer(1, "T", "E1", 200)],
      ticks: makeFreezeTicks(2, 1, 64),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "Enemy",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const base = series.tagsByDemo.get(demo.id)?.[0];
    expect(base).toBeTruthy();
    series.tagsByDemo.set(demo.id, [
      { ...base!, sideForFocal: "CT" },
      { ...base!, sideForFocal: "T" },
    ]);
    const ct = overlayRoster(series, { side: "CT", kind: base!.kind });
    const t = overlayRoster(series, { side: "T", kind: base!.kind });
    expect(ct.map((p) => p.name)).toEqual(["A1"]);
    expect(t).toEqual([]);
  });

  it("does not sample opponent CTs when a tag invents the opposite focal side", () => {
    const focal = "Team A";
    const ticks = makeTicks(2, 3);
    for (let f = 0; f < 3; f++) {
      ticks.ticks[f] = 64 + f * 64;
      for (let i = 0; i < 2; i++) {
        const slot = f * 2 + i;
        ticks.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (i === 0 ? FLAG_CT : 0);
      }
    }
    const replay = makeReplay({
      header: { team_ct: "Enemy", team_t: focal },
      players: [makePlayer(0, "CT", "npl", 100), makePlayer(1, "T", "donk", 200)],
      ticks,
      grenades: [
        makeGrenade({
          kind: "smoke",
          thrower: 0,
          start_tick: 80,
          points: [{ tick: 80, x: 1, y: 1, z: 0 }],
        }),
        makeGrenade({
          kind: "flash",
          thrower: 1,
          start_tick: 80,
          points: [{ tick: 80, x: 2, y: 2, z: 0 }],
        }),
      ],
      rounds: [
        makeRound({
          number: 1,
          team_ct: "Enemy",
          team_t: focal,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const base = series.tagsByDemo.get(demo.id)?.[0];
    expect(base).toBeTruthy();
    series.tagsByDemo.set(demo.id, [
      { ...base!, sideForFocal: "CT", kind: "full" },
      { ...base!, sideForFocal: "T", kind: "full" },
    ]);
    const ct = buildSeriesOverlay(series, { side: "CT", kind: "full" });
    const t = buildSeriesOverlay(series, { side: "T", kind: "full" });
    expect(ct.trails.map((trail) => trail.playerName)).toEqual([]);
    expect(ct.nades).toEqual([]);
    expect(t.trails.map((trail) => trail.playerName)).toEqual(["donk"]);
    expect(t.nades.map((nade) => nade.kind)).toEqual(["flash"]);
  });

  it("keeps a non-empty Spirit-only CT overlay when CT habits windows exist", () => {
    const focal = "Team Spirit";
    const ticks = makeTicks(2, 3);
    for (let f = 0; f < 3; f++) {
      ticks.ticks[f] = 64 + f * 64;
      for (let i = 0; i < 2; i++) {
        const slot = f * 2 + i;
        ticks.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (i === 0 ? FLAG_CT : 0);
      }
    }
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "Enemy" },
      players: [makePlayer(0, "CT", "donk", 200), makePlayer(1, "T", "npl", 100)],
      ticks,
      rounds: [
        makeRound({
          number: 14,
          team_ct: focal,
          team_t: "Enemy",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_dust2", [demo], focal);
    const base = series.tagsByDemo.get(demo.id)?.[0];
    expect(base).toBeTruthy();
    series.tagsByDemo.set(demo.id, [{ ...base!, sideForFocal: "CT", kind: "full" }]);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "full" });
    expect(overlay.trails.map((trail) => trail.playerName)).toEqual(["donk"]);
    expect(overlay.trails.some((trail) => trail.playerName === "npl")).toBe(false);
    const legend = analyzerPawnLegend(
      { ...series, demos: [demo, { ...demo, id: "d2" }] },
      { aggregated: true, overlayOn: true, bucketOverlay: { kind: "full", side: "CT" } },
      overlay,
    );
    expect(legend.map((row) => row.label)).toEqual(["donk"]);
  });
});
