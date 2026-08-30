import { describe, expect, it } from "vitest";
import { makeGrenade, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { aggregateUtilSets } from "./seriesUtilSets";

describe("aggregateUtilSets", () => {
  it("counts repeated first-wave util multisets", () => {
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
          end_tick: 2000,
        }),
        makeRound({
          number: 2,
          team_ct: focal,
          team_t: "B",
          start_tick: 800,
          freeze_end_tick: 864,
          end_tick: 2800,
        }),
      ],
      grenades: [
        makeGrenade({ kind: "smoke", start_tick: 100, thrower: 0 }),
        makeGrenade({ kind: "flash", start_tick: 120, thrower: 0 }),
        makeGrenade({ kind: "smoke", start_tick: 900, thrower: 0 }),
        makeGrenade({ kind: "flash", start_tick: 920, thrower: 0 }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const pistol = aggregateUtilSets(series, { side: "CT", kind: "pistol" }, null);
    expect(pistol.roundCount).toBe(1);
    expect(pistol.entries.length).toBeGreaterThan(0);
    expect(pistol.entries[0]?.count).toBe(1);
  });
});
