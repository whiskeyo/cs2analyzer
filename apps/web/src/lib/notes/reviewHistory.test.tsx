import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyNote } from "./note";
import { useRoundNoteHistory } from "./reviewHistory";

describe("useRoundNoteHistory", () => {
  it("supports undo and redo", () => {
    const first = [
      {
        round: 1,
        note: {
          ...emptyNote(),
          drawings: [{ type: "pen" as const, color: "#fff", points: [{ x: 0, y: 0 }] }],
        },
      },
    ];
    const second = [
      {
        round: 1,
        note: {
          ...emptyNote(),
          drawings: [
            { type: "pen" as const, color: "#fff", points: [{ x: 0, y: 0 }] },
            { type: "arrow" as const, color: "#fff", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
          ],
        },
      },
    ];
    const { result } = renderHook(() => useRoundNoteHistory());

    act(() => {
      result.current.commitNotes(first, true);
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(1);
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.commitNotes(second);
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(1);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(2);
  });

  it("undoes RoundNote history without flattening", () => {
    const first = [{ round: 1, note: { ...emptyNote(), drawings: [] } }];
    const { result } = renderHook(() => useRoundNoteHistory());
    act(() => {
      result.current.commitNotes(first, true);
    });
    act(() => {
      result.current.commitNotes([
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
          },
        },
      ]);
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(1);
    act(() => {
      result.current.undo();
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(0);
  });
});
