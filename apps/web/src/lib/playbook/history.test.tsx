import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { emptyNote } from "@/lib/notes/note";
import type { Note } from "@/lib/notes/types";
import { useNoteHistory } from "./history";

function withPen(color: string): Note {
  return {
    ...emptyNote(),
    drawings: [{ type: "pen", color, points: [{ x: 1, y: 1 }] }],
  };
}

describe("useNoteHistory", () => {
  it("undoes and redoes a committed note", () => {
    const { result } = renderHook(() => useNoteHistory("page-1", emptyNote()));
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.pushPresent(withPen("#fff"));
    });
    expect(result.current.canUndo).toBe(true);

    let undone: Note | null = emptyNote();
    act(() => {
      undone = result.current.undo();
    });
    expect(undone?.drawings).toEqual([]);
    expect(result.current.canRedo).toBe(true);

    let redone: Note | null = emptyNote();
    act(() => {
      redone = result.current.redo();
    });
    expect(redone?.drawings).toHaveLength(1);
  });

  it("clears the stack when the page changes", () => {
    const { result, rerender } = renderHook(({ pageId }) => useNoteHistory(pageId, emptyNote()), {
      initialProps: { pageId: "a" },
    });
    act(() => {
      result.current.pushPresent(withPen("#000"));
    });
    rerender({ pageId: "b" });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
