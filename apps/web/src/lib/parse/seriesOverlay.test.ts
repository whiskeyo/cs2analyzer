import { describe, expect, it } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { buildSeriesOverlay } from "./seriesOverlay";
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
  it("is stable for the same Steam ID", () => {
    expect(steamColor(123456789)).toBe(steamColor(123456789));
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
    expect(overlay.trails.length).toBeGreaterThan(0);
    expect(overlay.trails[0].points.length).toBeGreaterThan(1);
  });
});
