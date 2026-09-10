import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeFreezeTicks, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { usePlayerSync } from "./usePlayerSync";

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

describe("usePlayerSync", () => {
  it("does not remap on a single-demo series", () => {
    const solo = makeDemo("solo.dem", 0);
    const series = buildSeries("de_mirage", [solo], FOCAL);
    const setSelected = vi.fn();
    renderHook(() =>
      usePlayerSync({
        series,
        replay: solo.replay,
        activeDemoId: solo.id,
        selected: null,
        setSelected,
        playerKey: "steam:100",
      }),
    );
    expect(setSelected).not.toHaveBeenCalled();
  });

  it("remaps the radar slot from the player key when the series file changes", () => {
    const a = makeDemo("a.dem", 0);
    const b = makeDemo("b.dem", 1);
    const series = buildSeries("de_mirage", [a, b], FOCAL);
    const setSelected = vi.fn();
    const state: {
      series: ReturnType<typeof buildSeries>;
      replay: typeof a.replay;
      activeDemoId: string;
      selected: number | null;
      setSelected: typeof setSelected;
      playerKey: string | null;
    } = {
      series,
      replay: a.replay,
      activeDemoId: a.id,
      selected: 0,
      setSelected,
      playerKey: "steam:100",
    };
    const { rerender } = renderHook((s) => usePlayerSync(s), { initialProps: state });
    setSelected.mockClear();

    act(() => {
      rerender({
        ...state,
        replay: b.replay,
        activeDemoId: b.id,
        selected: null,
      });
    });

    expect(setSelected).toHaveBeenCalledWith(1);
  });
});
