import { afterEach, describe, expect, it, vi } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import {
  makeGrenade,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { playerIdentityKey } from "./seriesRoster";
import { buildSeries, loadedDemo } from "./session";
import { DEFAULT_PATH_BRANCH_OPTIONS } from "./pathBranches";
import {
  bucketWindowSecForTag,
  buildSeriesOverlay,
  clampSeriesTrailWindowSec,
  filterHabitsNades,
  loadHabitsTrailWindowSec,
  habitsArrowAtScreen,
  habitsArrowJumpTick,
  habitsNadeViewTick,
  overlayAtPlaySec,
  overlayRoster,
} from "./seriesOverlay";
import { nadeRenderAt } from "@/lib/radar/radarFrame";
import { PLAYER_TINTS, UNKNOWN_STEAM_TINT } from "@/lib/notes/palettes";
import { steamColor } from "./seriesSteamColor";

function makeTrailTicks(frames = 5): ReturnType<typeof makeTicks> {
  const playerCount = 10;
  const ctCount = 5;
  const buf = makeTicks(playerCount, frames);
  for (let f = 0; f < frames; f++) {
    buf.ticks[f] = 64 + f * 64;
    for (let i = 0; i < playerCount; i++) {
      const slot = f * playerCount + i;
      buf.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (i < ctCount ? FLAG_CT : 0);
      buf.x[slot] = 100 + f * 12;
      buf.y[slot] = 200;
    }
  }
  return buf;
}

describe("steamColor", () => {
  it("assigns distinct palette tints per Steam ID and stays stable", () => {
    const assigned = new Map<string, string>();
    expect(steamColor(123456789, assigned)).toBe(PLAYER_TINTS[0]);
    expect(steamColor(987654321, assigned)).toBe(PLAYER_TINTS[1]);
    expect(steamColor(123456789, assigned)).toBe(PLAYER_TINTS[0]);
    expect(steamColor(0, assigned)).toBe(UNKNOWN_STEAM_TINT);
    expect(steamColor(987654321, assigned)).not.toBe(steamColor(123456789, assigned));
  });
});

describe("buildSeriesOverlay", () => {
  it("aligns trails from freeze across matched rounds", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" });
    expect(overlay.roundCount).toBe(1);
    expect(overlay.windowSec).toBeGreaterThan(20);
    expect(overlay.trails.length).toBeGreaterThan(0);
    expect(overlay.trails[0].points.length).toBeGreaterThan(1);
  });

  it("gives each Steam ID a distinct overlay tint from the shared palette", () => {
    const focal = "Team A";
    const playerCount = 10;
    const ctCount = 5;
    const players = Array.from({ length: playerCount }, (_, i) =>
      makePlayer(i, i < ctCount ? "CT" : "T", `P${i}`, 100 + i),
    );
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      players,
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" });
    const colors = overlay.trails.map((trail) => trail.color);
    expect(new Set(colors).size).toBe(ctCount);
    expect(colors).toEqual(PLAYER_TINTS.slice(0, ctCount));
  });

  it("shortens trails when the window is smaller", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(20),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 5000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const short = buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 5);
    const long = buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 20);
    expect(short.trails[0]?.points.length ?? 0).toBeLessThan(long.trails[0]?.points.length ?? 0);
  });

  it("clips a full overlay to a freeze-relative playhead without rebuilding", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(20),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 5000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const full = buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 20);
    const early = overlayAtPlaySec(full, 1);
    const late = overlayAtPlaySec(full, 20);
    expect(early.trails[0]?.points.length ?? 0).toBeLessThan(late.trails[0]?.points.length ?? 0);
    expect(early.windowSec).toBe(full.windowSec);
    expect(overlayAtPlaySec(full, 0).trails.length).toBeGreaterThan(0);
  });

  it("lists overlay roster players for the selected side, not the whole focal team", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
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
    expect(ct.length).toBeGreaterThan(0);
    expect(t.length).toBeGreaterThan(0);
    expect(ct.some((p) => t.some((row) => row.key === p.key))).toBe(false);
  });

  it("uses round end for the bucket window when not overridden", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(5),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 64 + 64 * 90,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const tag = series.tagsByDemo.get(demo.id)?.[0];
    expect(tag).toBeDefined();
    expect(bucketWindowSecForTag(replay, tag!)).toBe(90);
  });

  it("truncates trails at death and records a death mark", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(30),
      kills: [makeKill(64 + 64 * 5, 1, 0, { x: 150, y: 200 })],
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 5000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" });
    const trail = overlay.trails.find((t) => t.playerName !== "?") ?? overlay.trails[0];
    expect(trail?.deathAt).toEqual({ x: 150, y: 200 });
    expect(trail?.deathTick).toBe(64 + 64 * 5);
    expect(trail?.survivedAt).toBeNull();
    const clipped = overlayAtPlaySec(overlay, 3);
    expect(clipped.trails[0]?.deathAt).toBeNull();
  });

  it("stops a trail at round end instead of drawing into the next spawn", () => {
    const focal = "Team A";
    const playerCount = 10;
    const ctCount = 5;
    const inRound = 8;
    const spawnTick = 800;
    const buf = makeTicks(playerCount, inRound + 2);
    for (let f = 0; f < inRound; f++) {
      buf.ticks[f] = 64 + f * 64;
      for (let i = 0; i < playerCount; i++) {
        const slot = f * playerCount + i;
        buf.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (i < ctCount ? FLAG_CT : 0);
        buf.x[slot] = 100 + f * 12;
        buf.y[slot] = 200;
      }
    }
    for (let f = inRound; f < inRound + 2; f++) {
      buf.ticks[f] = spawnTick + (f - inRound) * 64;
      for (let i = 0; i < playerCount; i++) {
        const slot = f * playerCount + i;
        buf.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (i < ctCount ? FLAG_CT : 0);
        buf.x[slot] = 10;
        buf.y[slot] = 5000;
      }
    }
    const roundEnd = 64 + (inRound - 1) * 64 + 32;
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: buf,
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: roundEnd,
        }),
        makeRound({
          number: 2,
          team_ct: focal,
          team_t: "B",
          start_tick: spawnTick,
          freeze_end_tick: spawnTick,
          end_tick: 5000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 20);
    const trail = overlay.trails.find((t) => t.playerName === "A") ?? overlay.trails[0];
    expect(trail).toBeDefined();
    expect(trail!.points.every((p) => p.y !== 5000)).toBe(true);
    expect(trail!.points.at(-1)?.y).toBe(200);
    expect(trail!.survivedAt).toEqual({ x: 100 + (inRound - 1) * 12, y: 200 });
    expect(trail!.survivedTick).toBe(roundEnd);
    expect(trail!.deathAt).toBeNull();
    const midRound = overlayAtPlaySec(overlay, 2);
    expect(midRound.trails[0]?.survivedAt).toBeNull();
    const afterRound = overlayAtPlaySec(overlay, 20);
    expect(afterRound.trails[0]?.survivedAt).toEqual(trail!.survivedAt);
  });

  it("includes focal-team util arcs inside the trail window", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
      grenades: [
        makeGrenade({
          kind: "smoke",
          thrower: 0,
          start_tick: 100,
          points: [
            { tick: 100, x: 50, y: 50, z: 0 },
            { tick: 120, x: 200, y: 200, z: 0 },
          ],
        }),
        makeGrenade({
          kind: "flash",
          thrower: 5,
          start_tick: 100,
          points: [{ tick: 100, x: 10, y: 10, z: 0 }],
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 8);
    expect(overlay.nades).toHaveLength(1);
    expect(overlay.nades[0]?.kind).toBe("smoke");
    expect(overlay.nades[0]?.grenade.points.length).toBe(2);
    expect(overlay.branches.length).toBeGreaterThan(0);
  });

  it("scopes Overall branches to one player or the whole side", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      players: [
        makePlayer(0, "CT", "A", 100),
        makePlayer(1, "CT", "B", 101),
        makePlayer(2, "T", "C", 200),
      ],
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const filter = { side: "CT" as const, kind: "pistol" as const };
    const team = buildSeriesOverlay(series, filter, null, 8);
    const one = buildSeriesOverlay(series, filter, playerIdentityKey(replay, 0), 8);
    expect(one.trails.length).toBeGreaterThan(0);
    expect(one.trails.length).toBeLessThan(team.trails.length);
    expect(team.branches[0]?.totalRuns).toBe(team.trails.length);
    expect(one.branches[0]?.totalRuns).toBe(one.trails.length);
  });

  it("builds Overall branches with the caller-supplied path knobs", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 8, {
      mergeDistance: 400,
      stepDistance: 96,
      minShare: 0.1,
    });
    expect(overlay.branchOptions).toEqual({
      mergeDistance: 400,
      stepDistance: 96,
      minShare: 0.1,
    });
    const clipped = overlayAtPlaySec(overlay, 2);
    expect(clipped.branchOptions).toEqual(overlay.branchOptions);
  });

  it("renders in-flight nades with a partial arc at the playhead", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "B" },
      ticks: makeTrailTicks(),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "B",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 2000,
        }),
      ],
      grenades: [
        makeGrenade({
          kind: "smoke",
          thrower: 0,
          start_tick: 100,
          detonate_tick: 200,
          end_tick: 2000,
          points: [
            { tick: 100, x: 50, y: 50, z: 0 },
            { tick: 150, x: 125, y: 125, z: 0 },
            { tick: 200, x: 200, y: 200, z: 0 },
          ],
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const overlay = buildSeriesOverlay(series, { side: "CT", kind: "pistol" });
    const nade = overlay.nades[0];
    expect(nade).toBeDefined();
    const early = nadeRenderAt(
      nade!.grenade,
      habitsNadeViewTick(nade!, 0.75),
      nade!.tps,
      1,
      nade!.roundEndTick,
    );
    const late = nadeRenderAt(
      nade!.grenade,
      habitsNadeViewTick(nade!, 1.5),
      nade!.tps,
      1,
      nade!.roundEndTick,
    );
    expect(early?.phase).toBe("flight");
    expect(late?.phase).toBe("flight");
    if (early?.phase === "flight" && late?.phase === "flight") {
      expect(early.trail.length).toBeLessThan(late.trail.length);
    }
  });
});

describe("habitsArrowAtScreen", () => {
  it("hits the head of a visible trail", () => {
    const overlay = {
      trails: [
        {
          demoId: "a",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "A",
          color: "#fff",
          points: [
            { x: 0, y: 0, z: 0, tick: 64, yaw: 90 },
            { x: 100, y: 100, z: 0, tick: 128, yaw: 45 },
          ],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
      ],
      branches: [],
      branchOptions: DEFAULT_PATH_BRANCH_OPTIONS,
      nades: [],
      roundCount: 1,
      windowSec: 20,
    };
    const toScreen = (x: number, y: number) => ({ x, y });
    const hit = habitsArrowAtScreen(overlay, true, 100, 100, toScreen, 20);
    expect(hit?.demoId).toBe("a");
    expect(habitsArrowAtScreen(overlay, false, 100, 100, toScreen)).toBeNull();
  });
});

describe("habitsArrowJumpTick", () => {
  it("uses the head point tick when present", () => {
    const trail = {
      demoId: "a",
      roundNumber: 1,
      jumpTick: 64,
      tps: 64,
      steamId: 1,
      playerName: "A",
      color: "#fff",
      points: [
        { x: 0, y: 0, z: 0, tick: 64, yaw: 90 },
        { x: 100, y: 100, z: 0, tick: 320, yaw: 45 },
      ],
      deathAt: null,
      deathTick: null,
      survivedAt: null,
      survivedTick: null,
    };
    expect(habitsArrowJumpTick(trail)).toBe(320);
    expect(habitsArrowJumpTick({ ...trail, points: [] })).toBe(64);
  });
});

describe("clampSeriesTrailWindowSec", () => {
  it("rounds and clamps to the allowed range", () => {
    expect(clampSeriesTrailWindowSec(20)).toBe(20);
    expect(clampSeriesTrailWindowSec(20.6)).toBe(21);
    expect(clampSeriesTrailWindowSec(3)).toBe(5);
    expect(clampSeriesTrailWindowSec(90)).toBe(60);
    expect(clampSeriesTrailWindowSec(Number.NaN)).toBe(20);
  });
});

describe("loadHabitsTrailWindowSec", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the legacy localStorage key and clamps it", () => {
    const store = new Map<string, string>([["cs2analyzer.seriesTrailWindowSec", "30"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
    });
    expect(loadHabitsTrailWindowSec()).toBe(30);
    store.set("cs2analyzer.seriesTrailWindowSec", "2");
    expect(loadHabitsTrailWindowSec()).toBe(5);
  });
});

describe("filterHabitsNades", () => {
  it("keeps only enabled util kinds", () => {
    const stub = makeGrenade({ kind: "smoke" });
    const nades = [
      {
        kind: "smoke" as const,
        color: "#fff",
        grenade: stub,
        freezeEndTick: 0,
        roundEndTick: 1000,
        tps: 64,
      },
      {
        kind: "flash" as const,
        color: "#fff",
        grenade: makeGrenade({ kind: "flash" }),
        freezeEndTick: 0,
        roundEndTick: 1000,
        tps: 64,
      },
      {
        kind: "decoy" as const,
        color: "#fff",
        grenade: makeGrenade({ kind: "decoy" }),
        freezeEndTick: 0,
        roundEndTick: 1000,
        tps: 64,
      },
    ];
    const filtered = filterHabitsNades(nades, {
      smoke: true,
      molotov: false,
      flash: false,
      he: false,
    });
    expect(filtered.map((n) => n.kind)).toEqual(["smoke"]);
  });
});
