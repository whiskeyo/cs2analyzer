import { describe, expect, it } from "vitest";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { playerIdentityKey } from "@/lib/parse/seriesRoster";
import { makeFreezeTicks, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { demoHopSelected, habitsKeyPatch, radarSelectPatch } from "./playerSelection";

const FOCAL = "Team A";

function makeDemo(fileName: string, donkIndex: 0 | 1, steamId = 100) {
  const replay = makeReplay({
    header: { team_ct: FOCAL, team_t: "Enemy" },
    players: [
      makePlayer(
        0,
        donkIndex === 0 ? "CT" : "T",
        donkIndex === 0 ? "Donk" : "Enemy",
        donkIndex === 0 ? steamId : 200,
      ),
      makePlayer(
        1,
        donkIndex === 1 ? "CT" : "T",
        donkIndex === 1 ? "Donk" : "Enemy",
        donkIndex === 1 ? steamId : 200,
      ),
    ],
    ticks: makeFreezeTicks(2, 1, 64),
    rounds: [
      makeRound({
        number: 1,
        team_ct: FOCAL,
        team_t: "Enemy",
        start_tick: 0,
        freeze_end_tick: 64,
      }),
    ],
  });
  return loadedDemo(replay, fileName, new File([], fileName));
}

describe("playerSelection", () => {
  it("radar click in a single demo only sets the slot (GOTV/spec HUD uses this too)", () => {
    const demo = makeDemo("solo.dem", 0);
    const series = buildSeries("de_mirage", [demo], FOCAL);
    expect(radarSelectPatch({ index: 0, series, replay: demo.replay, tick: 64 })).toEqual({
      selected: 0,
    });
    expect(radarSelectPatch({ index: null, series, replay: demo.replay, tick: 64 })).toEqual({
      selected: null,
    });
  });

  it("radar click in a multi-demo series writes the Steam/name key and may flip focal team", () => {
    const a = makeDemo("a.dem", 0);
    const b = makeDemo("b.dem", 1);
    const series = buildSeries("de_mirage", [a, b], FOCAL);
    const donkKey = playerIdentityKey(a.replay, 0);
    expect(radarSelectPatch({ index: 0, series, replay: a.replay, tick: 64 })).toEqual({
      selected: 0,
      playerKey: donkKey,
    });
    expect(radarSelectPatch({ index: 1, series, replay: a.replay, tick: 64 })).toEqual({
      selected: 1,
      playerKey: playerIdentityKey(a.replay, 1),
      focalTeam: "Enemy",
    });
    expect(radarSelectPatch({ index: null, series, replay: a.replay, tick: 64 })).toEqual({
      selected: null,
      playerKey: null,
    });
  });

  it("series player list derives the slot from the key", () => {
    const a = makeDemo("a.dem", 0);
    expect(habitsKeyPatch({ playerKey: "steam:100", replay: a.replay })).toEqual({
      selected: 0,
      playerKey: "steam:100",
    });
    expect(habitsKeyPatch({ playerKey: null, replay: a.replay })).toEqual({
      selected: null,
      playerKey: null,
    });
  });

  it("remaps the slot when the series hops files", () => {
    const b = makeDemo("b.dem", 1);
    expect(demoHopSelected(b.replay, "steam:100")).toBe(1);
    expect(demoHopSelected(b.replay, null)).toBeNull();
  });
});
