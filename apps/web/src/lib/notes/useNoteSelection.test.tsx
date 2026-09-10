import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyNote } from "./note";
import { useNoteSelection } from "./useNoteSelection";
import type { RoundNote } from "./types";

function notes(): RoundNote[] {
  return [
    {
      round: 1,
      note: {
        ...emptyNote(),
        drawings: [
          { type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] },
          { type: "pen", color: "#fff", points: [{ x: 1, y: 1 }] },
        ],
      },
    },
    {
      round: 2,
      note: {
        ...emptyNote(),
        groups: [
          {
            id: "g1",
            name: "g1",
            drawings: [{ type: "pen", color: "#fff", points: [{ x: 2, y: 2 }] }],
          },
        ],
      },
    },
  ];
}

describe("useNoteSelection", () => {
  it("tracks multi-select and group eligibility", () => {
    const { result } = renderHook(({ list }) => useNoteSelection(list), {
      initialProps: { list: notes() },
    });

    act(() => {
      result.current.toggle({ round: 1, ref: { kind: "loose", index: 0 } });
      result.current.toggle({ round: 1, ref: { kind: "loose", index: 1 } });
    });
    expect(result.current.selected).toHaveLength(2);
    expect(result.current.canGroup).toBe(true);
    expect(result.current.canUngroup).toBe(false);

    act(() => {
      result.current.toggle({ round: 2, ref: { kind: "group", groupIndex: 0, drawingIndex: 0 } });
    });
    expect(result.current.canGroup).toBe(false);
    expect(result.current.canUngroup).toBe(true);

    act(() => {
      result.current.toggleAll([
        { round: 1, ref: { kind: "loose", index: 0 } },
        { round: 1, ref: { kind: "loose", index: 1 } },
      ]);
    });
    expect(result.current.selected).toEqual([
      { round: 2, ref: { kind: "group", groupIndex: 0, drawingIndex: 0 } },
    ]);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selected).toEqual([]);
  });
});
