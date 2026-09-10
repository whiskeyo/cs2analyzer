import { describe, expect, it } from "vitest";
import { makeFreezeTicks, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { defaultFocalTeam, loadedDemo, seriesTeamCandidates } from "./session";
import { focalRosterForSeries, playerIdentityKey, playerTeamNameAt } from "./seriesRoster";
import { buildSeries } from "./session";

describe("seriesTeamCandidates", () => {
  it("ranks teams by how many demos include them", () => {
    const demos = [
      loadedDemo(
        makeReplay({ header: { team_ct: "Alpha", team_t: "Bravo" } }),
        "a.dem",
        new File([], "a.dem"),
      ),
      loadedDemo(
        makeReplay({ header: { team_ct: "Alpha", team_t: "Charlie" } }),
        "b.dem",
        new File([], "b.dem"),
      ),
      loadedDemo(
        makeReplay({ header: { team_ct: "Delta", team_t: "Alpha" } }),
        "c.dem",
        new File([], "c.dem"),
      ),
    ];
    const teams = seriesTeamCandidates(demos);
    expect(teams[0]).toMatchObject({ name: "Alpha", demoCount: 3 });
    expect(defaultFocalTeam(demos)).toBe("Alpha");
  });

  it("breaks demo-count ties using the first demo CT side", () => {
    const demo = loadedDemo(
      makeReplay({ header: { team_ct: "Team A", team_t: "B" } }),
      "a.dem",
      new File([], "a.dem"),
    );
    expect(defaultFocalTeam([demo])).toBe("Team A");
  });
});

describe("focalRosterForSeries", () => {
  it("lists only focal-team players, not the enemy roster", () => {
    const focal = "Team A";
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "Enemy" },
      players: [
        { index: 0, steam_id: 100, name: "A1", start_side: "CT", is_bot: false },
        { index: 1, steam_id: 200, name: "E1", start_side: "T", is_bot: false },
      ],
      ticks: makeFreezeTicks(2, 1, 64),
      rounds: [
        makeRound({
          number: 1,
          team_ct: focal,
          team_t: "Enemy",
          start_tick: 0,
          freeze_end_tick: 64,
        }),
      ],
    });
    const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const series = buildSeries("de_mirage", [demo], focal);
    const roster = focalRosterForSeries(series);
    expect(roster.map((p) => p.name)).toEqual(["A1"]);
    expect(playerIdentityKey(replay, 0)).toBe("steam:100");
  });
});

describe("playerTeamNameAt", () => {
  it("returns the live team name for a player side", () => {
    const replay = makeReplay({
      header: { team_ct: "Alpha", team_t: "Bravo" },
      ticks: makeFreezeTicks(2, 1, 64),
    });
    expect(playerTeamNameAt(replay, 0, 64)).toBe("Alpha");
    expect(playerTeamNameAt(replay, 1, 64)).toBe("Bravo");
  });
});
