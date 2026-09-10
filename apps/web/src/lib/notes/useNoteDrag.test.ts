/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { DragEvent as ReactDragEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { emptyNote } from "./note";
import { useNoteDrag } from "./useNoteDrag";
import type { RoundNote } from "./types";

function notes(): RoundNote[] {
  return [
    {
      round: 1,
      note: {
        ...emptyNote(),
        groups: [
          {
            id: "Group 1",
            name: "Group 1",
            drawings: [
              {
                type: "pen",
                color: "#fff",
                points: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ],
              },
              {
                type: "pen",
                color: "#fff",
                points: [
                  { x: 2, y: 2 },
                  { x: 3, y: 3 },
                ],
              },
            ],
          },
        ],
      },
    },
  ];
}

function dragEvent(getData = '{"round":1,"refs":[{"kind":"loose","index":0}]}') {
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
    const onNotes = vi.fn();
    const clearSelection = vi.fn();
    const { result } = renderHook(() => useNoteDrag({ notes: notes(), onNotes, clearSelection }));
    const event = dragEvent();
    const refs = [
      { kind: "group" as const, groupIndex: 0, drawingIndex: 0 },
      { kind: "group" as const, groupIndex: 0, drawingIndex: 1 },
    ];

    act(() => result.current.startDrag(event, 1, refs));

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      "text/plain",
      JSON.stringify({ round: 1, refs }),
    );
    expect(result.current.dragging).toEqual({ round: 1, refs });
  });

  it("blocks drag start from note controls", () => {
    const { result } = renderHook(() =>
      useNoteDrag({ notes: notes(), onNotes: vi.fn(), clearSelection: vi.fn() }),
    );
    const input = document.createElement("input");
    result.current.downOnRef.current = input;
    const event = dragEvent();

    act(() => result.current.startDrag(event, 1, [{ kind: "loose", index: 0 }]));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.dragging).toBeNull();
  });

  it("drops drawings onto a destination in the same round", () => {
    const onNotes = vi.fn();
    const clearSelection = vi.fn();
    const { result } = renderHook(() => useNoteDrag({ notes: notes(), onNotes, clearSelection }));
    const refs = [
      { kind: "group" as const, groupIndex: 0, drawingIndex: 0 },
      { kind: "group" as const, groupIndex: 0, drawingIndex: 1 },
    ];
    const start = dragEvent();

    act(() => result.current.startDrag(start, 1, refs));
    const drop = dragEvent(JSON.stringify({ round: 1, refs }));

    act(() => result.current.dropAt(drop, { round: 1, kind: "ungroup" }));

    expect(onNotes).toHaveBeenCalledTimes(1);
    expect(onNotes.mock.calls[0][0][0].note.groups).toHaveLength(0);
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(result.current.dragging).toBeNull();
  });

  it("ignores drops onto another round", () => {
    const onNotes = vi.fn();
    const { result } = renderHook(() =>
      useNoteDrag({ notes: notes(), onNotes, clearSelection: vi.fn() }),
    );

    act(() =>
      result.current.startDrag(dragEvent(), 1, [{ kind: "group", groupIndex: 0, drawingIndex: 0 }]),
    );
    act(() => result.current.dropAt(dragEvent(), { round: 2, kind: "ungroup" }));

    expect(onNotes).not.toHaveBeenCalled();
    expect(result.current.dragging).toBeNull();
  });

  it("highlights a valid drop target during drag-over", () => {
    const { result } = renderHook(() =>
      useNoteDrag({ notes: notes(), onNotes: vi.fn(), clearSelection: vi.fn() }),
    );

    act(() =>
      result.current.startDrag(dragEvent(), 1, [{ kind: "group", groupIndex: 0, drawingIndex: 0 }]),
    );
    const over = dragEvent();
    act(() => result.current.allowDrop(over, "round-1-ungroup", true));

    expect(over.preventDefault).toHaveBeenCalled();
    expect(result.current.dropOn).toBe("round-1-ungroup");
  });

  it("sets skipClickRef after a real drag ends", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useNoteDrag({ notes: notes(), onNotes: vi.fn(), clearSelection: vi.fn() }),
    );

    act(() => {
      result.current.startDrag(dragEvent(), 1, [{ kind: "group", groupIndex: 0, drawingIndex: 0 }]);
      result.current.markDrag();
      result.current.endDrag();
    });

    expect(result.current.skipClickRef.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(result.current.skipClickRef.current).toBe(false);
    vi.useRealTimers();
  });
});
