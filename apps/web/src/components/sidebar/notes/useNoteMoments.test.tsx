/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { emptyNote } from "@/lib/notes/note";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { useNoteMoments } from "./useNoteMoments";

describe("useNoteMoments", () => {
  it("updates moment edges, clocks, and clears windows", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    const notes = [
      {
        round: 1,
        note: {
          ...emptyNote(),
          drawings: [
            {
              type: "pen" as const,
              color: "#fff",
              points: [{ x: 0, y: 0 }],
              start_tick: 100,
              end_tick: 200,
            },
          ],
        },
      },
    ];
    const onNotes = vi.fn();
    const { result } = renderHook(() => useNoteMoments({ replay, tick: 120, notes, onNotes }));
    const round = replay.rounds.find((r) => r.number === 1);
    const ref = { kind: "loose" as const, index: 0 };

    act(() => result.current.setEdge(1, ref, "start", round));
    act(() => result.current.setClock(1, ref, "end", 5, round));
    act(() => result.current.clearWindow(1, ref));

    expect(onNotes).toHaveBeenCalledTimes(3);
    expect(result.current.tps).toBeGreaterThan(0);
  });
});
