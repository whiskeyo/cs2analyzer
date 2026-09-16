/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { playerIdentityKey } from "@/lib/parse/seriesRoster";
import { makeFreezeTicks, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { useSeriesHabits } from "./useSeriesHabits";

const FOCAL = "Team A";

function makeSeriesDemo(fileName: string) {
  const replay = makeReplay({
    header: { team_ct: FOCAL, team_t: "Enemy", map_name: "de_mirage" },
    players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "Enemy", 200)],
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

function renderHabits(
  activeDemoId?: string,
  trailWindowSec?: number,
  pathBranch?: {
    pathBranchMergeDistance?: number;
    pathBranchStepDistance?: number;
    pathBranchMinShare?: number;
  },
) {
  const demoA = makeSeriesDemo("a.dem");
  const demoB = makeSeriesDemo("b.dem");
  const series = buildSeries("de_mirage", [demoA, demoB], FOCAL);
  const selectDemo = vi.fn();
  const jump = vi.fn();

  const view = renderHook(
    (demoId: string) =>
      useSeriesHabits({
        series,
        places: null,
        activeDemoId: demoId,
        selectDemo,
        jump,
        trailWindowSec,
        ...pathBranch,
      }),
    { initialProps: activeDemoId ?? demoA.id },
  );

  return {
    ...view,
    series,
    demoA,
    demoB,
    selectDemo,
    jump,
    donkKey: playerIdentityKey(demoA.replay, 0),
  };
}

describe("useSeriesHabits", () => {
  it("starts with CT full-buy filter and per-demo view", () => {
    const { result } = renderHabits();
    expect(result.current.filter).toEqual({ side: "CT", kind: "full", playerKey: null });
    expect(result.current.seriesView).toBe("demos");
    expect(result.current.aggregated).toBe(false);
    expect(result.current.bucketOverlay).toBeNull();
  });

  it("clears bucket overlay when side or kind changes", () => {
    const { result } = renderHabits();

    act(() => {
      result.current.setSeriesView("aggregated");
      result.current.selectBucketOverlay("pistol", "CT");
    });
    expect(result.current.bucketOverlay).toEqual({ kind: "pistol", side: "CT" });

    act(() => result.current.setSide("T"));
    expect(result.current.bucketOverlay).toBeNull();
    expect(result.current.filter.side).toBe("T");

    act(() => {
      result.current.selectBucketOverlay("eco", "T");
    });
    expect(result.current.bucketOverlay).toEqual({ kind: "eco", side: "T" });

    act(() => result.current.setKind("full"));
    expect(result.current.bucketOverlay).toBeNull();
    expect(result.current.filter.kind).toBe("full");
  });

  it("toggles bucket overlay for the same bucket", () => {
    const { result } = renderHabits();

    act(() => {
      result.current.setSeriesView("aggregated");
      result.current.selectBucketOverlay("pistol", "CT");
    });
    expect(result.current.bucketOverlay).toEqual({ kind: "pistol", side: "CT" });

    act(() => result.current.selectBucketOverlay("pistol", "CT"));
    expect(result.current.bucketOverlay).toBeNull();
  });

  it("clears bucket overlay when leaving aggregated view", () => {
    const { result } = renderHabits();

    act(() => {
      result.current.setSeriesView("aggregated");
      result.current.selectBucketOverlay("pistol", "CT");
    });
    expect(result.current.bucketOverlay).not.toBeNull();

    act(() => result.current.setSeriesView("demos"));
    expect(result.current.bucketOverlay).toBeNull();
  });

  it("jumps immediately when playRound targets the active demo", () => {
    const { result, demoA, jump, selectDemo } = renderHabits();

    act(() => result.current.playRound({ demoId: demoA.id, jumpTick: 264 }));

    expect(jump).toHaveBeenCalledWith(264);
    expect(selectDemo).not.toHaveBeenCalled();
    expect(result.current.bucketOverlay).toBeNull();
  });

  it("selects another demo then jumps once it becomes active", () => {
    const { result, demoB, jump, selectDemo, rerender } = renderHabits();

    act(() => result.current.playRound({ demoId: demoB.id, jumpTick: 320 }));

    expect(selectDemo).toHaveBeenCalledWith(demoB.id);
    expect(jump).not.toHaveBeenCalled();

    act(() => rerender(demoB.id));
    expect(jump).toHaveBeenCalledWith(320);
    expect(result.current.bucketPlaySec).toBe(0);
  });

  it("stores and validates the habits player filter", () => {
    const { result, donkKey } = renderHabits();

    act(() => result.current.setPlayerKey(donkKey));
    expect(result.current.filter.playerKey).toBe(donkKey);
    expect(result.current.playerKey).toBe(donkKey);

    act(() => result.current.setPlayerKey("steam:999"));
    expect(result.current.filter.playerKey).toBe("steam:999");
    expect(result.current.playerKey).toBeNull();
  });

  it("applies the habits trail window to the overlay", () => {
    const { result } = renderHabits(undefined, 8);

    act(() => {
      result.current.setSeriesView("aggregated");
      result.current.selectBucketOverlay("full", "CT");
    });
    expect(result.current.overlay?.windowSec).toBe(8);
  });

  it("applies Overall path knobs to the overlay tree", () => {
    const { result } = renderHabits(undefined, 8, {
      pathBranchMergeDistance: 400,
      pathBranchStepDistance: 96,
      pathBranchMinShare: 0.1,
    });

    act(() => {
      result.current.setSeriesView("aggregated");
      result.current.selectBucketOverlay("full", "CT");
    });
    expect(result.current.overlay?.branchOptions).toEqual({
      mergeDistance: 400,
      stepDistance: 96,
      minShare: 0.1,
    });
  });
});
