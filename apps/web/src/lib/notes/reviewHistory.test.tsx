import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStrokeHistory } from "./reviewHistory";

describe("useStrokeHistory", () => {
  it("supports undo and redo", () => {
    const strokeA = {
      type: "pen" as const,
      round: 1,
      color: "#fff",
      points: [{ x: 0, y: 0 }],
    };
    const strokeB = {
      type: "arrow" as const,
      round: 1,
      color: "#fff",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    };
    const { result } = renderHook(() => useStrokeHistory());

    act(() => {
      result.current.commitStrokes([strokeA], true);
    });
    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.commitStrokes([strokeA, strokeB]);
    });
    expect(result.current.strokes).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });
    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.strokes).toHaveLength(2);
  });
});
