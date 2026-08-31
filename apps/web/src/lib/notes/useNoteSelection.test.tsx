import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useNoteSelection } from "./useNoteSelection";
import type { Stroke } from "./types";

function stroke(round: number, group?: string): Stroke {
  return {
    type: "pen",
    round,
    color: "#fff",
    points: [{ x: 0, y: 0 }],
    ...(group ? { group } : {}),
  };
}

describe("useNoteSelection", () => {
  it("tracks multi-select and group eligibility", () => {
    const strokes = [stroke(1), stroke(1), stroke(2, "g1")];
    const { result } = renderHook(({ list }) => useNoteSelection(list), {
      initialProps: { list: strokes },
    });

    act(() => {
      result.current.toggle(0);
      result.current.toggle(1);
    });
    expect(result.current.selected).toEqual([0, 1]);
    expect(result.current.canGroup).toBe(true);
    expect(result.current.canUngroup).toBe(false);

    act(() => {
      result.current.toggle(2);
    });
    expect(result.current.canGroup).toBe(false);
    expect(result.current.canUngroup).toBe(true);

    act(() => {
      result.current.toggleAll([0, 1]);
    });
    expect(result.current.selected).toEqual([2]);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selected).toEqual([]);
  });
});
