/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import type { Stroke } from "@/lib/notes/types";
import { useNoteMoments } from "./useNoteMoments";

function pen(): Stroke {
  return {
    type: "pen",
    round: 1,
    color: "#fff",
    points: [{ x: 0, y: 0 }],
    start_tick: 100,
    end_tick: 200,
  };
}

describe("useNoteMoments", () => {
  it("updates moment edges, clocks, and clears windows", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    const strokes = [pen()];
    const onStrokes = vi.fn();
    const { result } = renderHook(() => useNoteMoments({ replay, tick: 120, strokes, onStrokes }));
    const round = replay.rounds.find((r) => r.number === 1);

    act(() => result.current.setEdge(0, "start", round));
    act(() => result.current.setClock(0, "end", 5, round));
    act(() => result.current.clearWindow(0));

    expect(onStrokes).toHaveBeenCalledTimes(3);
    expect(result.current.tps).toBeGreaterThan(0);
  });
});
