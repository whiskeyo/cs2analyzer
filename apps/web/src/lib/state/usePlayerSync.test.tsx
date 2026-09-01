import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { playerIdentityKey } from "@/lib/parse/seriesRoster";
import { makeFreezeTicks, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { usePlayerSync } from "./usePlayerSync";

const FOCAL = "Team A";

function makeDemo(fileName: string, donkIndex: 0 | 1, steamId = 100) {
  const enemyIndex = donkIndex === 0 ? 1 : 0;
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
  return { demo: loadedDemo(replay, fileName, new File([], fileName)), donkIndex, enemyIndex };
}

function renderPlayerSync(
  props: Partial<{
    series: ReturnType<typeof buildSeries> | null;
    replay: ReturnType<typeof makeDemo>["demo"]["replay"] | null;
    activeDemoId: string | null;
    tick: number;
    selected: number | null;
    playerKey: string | null;
  }> = {},
) {
  const demoA = makeDemo("a.dem", 0);
  const demoB = makeDemo("b.dem", 1);
  const series = buildSeries("de_mirage", [demoA.demo, demoB.demo], FOCAL);
  const donkKey = playerIdentityKey(demoA.demo.replay, demoA.donkIndex);

  const select = vi.fn();
  const setPlayerKey = vi.fn();
  const setFocalTeam = vi.fn();

  const state = {
    series: props.series ?? series,
    replay: props.replay ?? demoA.demo.replay,
    activeDemoId: props.activeDemoId ?? demoA.demo.id,
    tick: props.tick ?? 64,
    selected: props.selected ?? null,
    playerKey: props.playerKey ?? null,
    select,
    setPlayerKey,
    setFocalTeam,
  };

  const view = renderHook(
    (s) =>
      usePlayerSync({
        series: s.series,
        replay: s.replay,
        activeDemoId: s.activeDemoId,
        tick: s.tick,
        selected: s.selected,
        playerKey: s.playerKey,
        select: s.select,
        setPlayerKey: s.setPlayerKey,
        setFocalTeam: s.setFocalTeam,
      }),
    { initialProps: state },
  );

  return { ...view, state, demoA, demoB, donkKey, select, setPlayerKey, setFocalTeam };
}

describe("usePlayerSync", () => {
  it("does nothing for a single-demo series", () => {
    const solo = makeDemo("solo.dem", 0);
    const series = buildSeries("de_mirage", [solo.demo], FOCAL);
    const { select, setPlayerKey } = renderPlayerSync({
      series,
      replay: solo.demo.replay,
      activeDemoId: solo.demo.id,
      playerKey: playerIdentityKey(solo.demo.replay, solo.donkIndex),
    });
    expect(select).not.toHaveBeenCalled();
    expect(setPlayerKey).not.toHaveBeenCalled();
  });

  it("selects a roster player when only the habits key is set", () => {
    const { donkKey, select } = renderPlayerSync({ playerKey: "steam:100", selected: null });
    expect(select).toHaveBeenCalledWith(0);
    expect(donkKey).toBe("steam:100");
  });

  it("tracks the player key when only radar selection is set", () => {
    const { setPlayerKey, donkKey } = renderPlayerSync({ selected: 0, playerKey: null });
    expect(setPlayerKey).toHaveBeenCalledWith(donkKey);
  });

  it("re-selects by player key when the active demo changes", () => {
    const { demoB, rerender, state, select } = renderPlayerSync({
      playerKey: "steam:100",
      selected: 0,
    });
    select.mockClear();

    act(() => {
      rerender({
        ...state,
        replay: demoB.demo.replay,
        activeDemoId: demoB.demo.id,
        selected: 0,
        playerKey: "steam:100",
      });
    });

    expect(select).toHaveBeenCalledWith(1);
  });

  it("clears radar selection when the habits filter is cleared", () => {
    const { rerender, state, select } = renderPlayerSync({
      playerKey: "steam:100",
      selected: 0,
    });
    select.mockClear();

    act(() => {
      rerender({
        ...state,
        playerKey: null,
        selected: 0,
      });
    });

    expect(select).toHaveBeenCalledWith(null);
  });

  it("updates the player key when radar selection changes", () => {
    const { rerender, state, setPlayerKey, donkKey } = renderPlayerSync({
      selected: null,
      playerKey: null,
    });
    setPlayerKey.mockClear();

    act(() => {
      rerender({
        ...state,
        selected: 0,
        playerKey: null,
      });
    });

    expect(setPlayerKey).toHaveBeenCalledWith(donkKey);
  });

  it("clears the player key when radar selection is cleared", () => {
    const { rerender, state, setPlayerKey } = renderPlayerSync({
      selected: 0,
      playerKey: "steam:100",
    });
    setPlayerKey.mockClear();

    act(() => {
      rerender({
        ...state,
        selected: null,
        playerKey: "steam:100",
      });
    });

    expect(setPlayerKey).toHaveBeenCalledWith(null);
  });
});
