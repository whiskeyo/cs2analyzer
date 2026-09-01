/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { DragEvent as ReactDragEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import type { Stroke } from "@/lib/notes/types";
import { useNoteDrag } from "./useNoteDrag";

function pen(round = 1, group?: string): Stroke {
  return {
    type: "pen",
    round,
    color: "#fff",
    group,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  };
}

function dragEvent(getData = '{"round":1,"indexes":[0]}') {
  const data = new Map<string, string>();
  const setData = vi.fn((type: string, value: string) => {
    data.set(type, value);
  });
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      effectAllowed: "",
      dropEffect: "",
      setData,
      getData: (type: string) => data.get(type) ?? getData,
    },
  } as unknown as ReactDragEvent;
}

describe("useNoteDrag", () => {
  it("starts a drag payload and exposes dragging state", () => {
    const onStrokes = vi.fn();
    const clearSelection = vi.fn();
    const strokes = [pen(), pen()];

    const { result } = renderHook(() => useNoteDrag({ strokes, onStrokes, clearSelection }));
    const event = dragEvent();

    act(() => result.current.startDrag(event, 1, [0, 1]));

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      "text/plain",
      JSON.stringify({ round: 1, indexes: [0, 1] }),
    );
    expect(result.current.dragging).toEqual({ round: 1, indexes: [0, 1] });
  });

  it("blocks drag start from note controls", () => {
    const { result } = renderHook(() =>
      useNoteDrag({ strokes: [pen()], onStrokes: vi.fn(), clearSelection: vi.fn() }),
    );
    const input = document.createElement("input");
    result.current.downOnRef.current = input;
    const event = dragEvent();

    act(() => result.current.startDrag(event, 1, [0]));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.dragging).toBeNull();
  });

  it("drops strokes onto a destination in the same round", () => {
    const strokes = [pen(1, "Group 1"), pen(1, "Group 1")];
    const onStrokes = vi.fn();
    const clearSelection = vi.fn();
    const { result } = renderHook(() => useNoteDrag({ strokes, onStrokes, clearSelection }));
    const start = dragEvent();

    act(() => result.current.startDrag(start, 1, [0, 1]));
    const drop = dragEvent(JSON.stringify({ round: 1, indexes: [0, 1] }));

    act(() => result.current.dropAt(drop, { round: 1, kind: "ungroup" }));

    expect(onStrokes).toHaveBeenCalledTimes(1);
    expect(onStrokes.mock.calls[0][0].every((s: Stroke) => s.group == null)).toBe(true);
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(result.current.dragging).toBeNull();
  });

  it("ignores drops onto another round", () => {
    const onStrokes = vi.fn();
    const { result } = renderHook(() =>
      useNoteDrag({ strokes: [pen(1)], onStrokes, clearSelection: vi.fn() }),
    );

    act(() => result.current.startDrag(dragEvent(), 1, [0]));
    act(() => result.current.dropAt(dragEvent(), { round: 2, kind: "ungroup" }));

    expect(onStrokes).not.toHaveBeenCalled();
    expect(result.current.dragging).toBeNull();
  });

  it("highlights a valid drop target during drag-over", () => {
    const { result } = renderHook(() =>
      useNoteDrag({ strokes: [pen()], onStrokes: vi.fn(), clearSelection: vi.fn() }),
    );

    act(() => result.current.startDrag(dragEvent(), 1, [0]));
    const over = dragEvent();
    act(() => result.current.allowDrop(over, "round-1-ungroup", true));

    expect(over.preventDefault).toHaveBeenCalled();
    expect(result.current.dropOn).toBe("round-1-ungroup");
  });

  it("sets skipClick after a real drag ends", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useNoteDrag({ strokes: [pen()], onStrokes: vi.fn(), clearSelection: vi.fn() }),
    );

    act(() => {
      result.current.startDrag(dragEvent(), 1, [0]);
      result.current.markDrag();
      result.current.endDrag();
    });

    expect(result.current.skipClick.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(result.current.skipClick.current).toBe(false);
    vi.useRealTimers();
  });
});
