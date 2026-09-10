import { describe, expect, it } from "vitest";
import { makeFreezeTicks, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { loadedDemo } from "./session";
import { mergeSeriesTeamCandidates, teamPrefixPair } from "./seriesTeams";

function demoWithTeam(teamCt: string, teamT: string, steamIds: number[]) {
  const replay = makeReplay({
    header: { team_ct: teamCt, team_t: teamT },
    players: steamIds.map((steam_id, index) => ({
      index,
      steam_id,
      name: `P${index}`,
      start_side: index < steamIds.length / 2 ? "CT" : "T",
      is_bot: false,
    })),
    ticks: makeFreezeTicks(Math.max(steamIds.length, 2), Math.ceil(steamIds.length / 2), 64),
    rounds: [
      makeRound({
        number: 1,
        team_ct: teamCt,
        team_t: teamT,
        start_tick: 0,
        freeze_end_tick: 64,
      }),
    ],
  });
  return loadedDemo(replay, `${teamCt}-vs-${teamT}.dem`, new File([], `${teamCt}.dem`));
}

describe("teamPrefixPair", () => {
  it("matches Team-prefixed names", () => {
    expect(teamPrefixPair("Spirit", "Team Spirit")).toBe(true);
    expect(teamPrefixPair("Spirit", "Spirit")).toBe(false);
  });
});

describe("mergeSeriesTeamCandidates", () => {
  it("merges Spirit and Team Spirit when rosters overlap", () => {
    const ids = [101, 102, 103, 104, 105];
    const a = demoWithTeam("Spirit", "Other", ids);
    const b = demoWithTeam("Team Spirit", "Enemy", ids);
    const merged = mergeSeriesTeamCandidates([a, b]);
    const spirit = merged.find((g) => g.aliases.includes("Spirit"));
    expect(spirit?.aliases).toEqual(expect.arrayContaining(["Spirit", "Team Spirit"]));
    expect(spirit?.demoCount).toBe(2);
  });

  it("keeps separate entries when rosters do not overlap", () => {
    const a = demoWithTeam("Spirit", "Other", [1, 2, 3, 4, 5]);
    const b = demoWithTeam("Team Spirit", "Enemy", [6, 7, 8, 9, 10]);
    const merged = mergeSeriesTeamCandidates([a, b]);
    expect(merged.some((g) => g.name === "Spirit")).toBe(true);
    expect(merged.some((g) => g.name === "Team Spirit")).toBe(true);
  });
});
