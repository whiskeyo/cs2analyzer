/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MutableRefObject } from "react";
import type { Stroke } from "@/lib/notes/types";
import { TextNoteEditor, useTextNotes } from "./TextNoteEditor";

function strokesRef(list: Stroke[] = []): MutableRefObject<Stroke[]> {
  return { current: list };
}

function renderEditor(
  result: ReturnType<typeof renderHook<ReturnType<typeof useTextNotes>, unknown>>["result"],
  wrap: HTMLDivElement | null = null,
) {
  render(
    <TextNoteEditor
      editing={result.current.editing!}
      wrapRef={{ current: wrap }}
      editWrapRef={result.current.editWrapRef}
      editAreaRef={result.current.editAreaRef}
      editingRef={result.current.editingRef}
      ignoreBlurRef={result.current.ignoreBlurRef}
      editDragRef={result.current.editDragRef}
      focusEditor={result.current.focusEditor}
      commitEditing={result.current.commitEditing}
      onTextKeyDown={result.current.onTextKeyDown}
      setEditing={result.current.setEditing}
    />,
  );
}

describe("useTextNotes", () => {
  it("commits a new note on Enter", async () => {
    const onStrokes = vi.fn();
    const strokes = strokesRef([]);
    const { result } = renderHook(() => useTextNotes(strokes, onStrokes));

    act(() => {
      result.current.beginEditing({
        index: null,
        x: 1,
        y: 2,
        sx: 10,
        sy: 20,
        text: "hello",
        color: "#fff",
        round: 1,
      });
    });

    renderEditor(result);
    await userEvent.type(screen.getByPlaceholderText("Note"), "{Enter}");
    expect(onStrokes).toHaveBeenCalledWith([
      expect.objectContaining({ type: "text", text: "hello", x: 1, y: 2 }),
    ]);
  });

  it("cancels editing on Escape", async () => {
    const onStrokes = vi.fn();
    const strokes = strokesRef([]);
    const { result } = renderHook(() => useTextNotes(strokes, onStrokes));

    act(() => {
      result.current.beginEditing({
        index: null,
        x: 0,
        y: 0,
        sx: 0,
        sy: 0,
        text: "draft",
        color: "#fff",
        round: 1,
      });
    });

    renderEditor(result);
    await userEvent.type(screen.getByPlaceholderText("Note"), "{Escape}");
    expect(onStrokes).not.toHaveBeenCalled();
    expect(result.current.editing).toBeNull();
  });

  it("starts a drag from the grip handle", () => {
    const onStrokes = vi.fn();
    const wrap = document.createElement("div");
    wrap.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 300,
        height: 300,
        right: 300,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const strokes = strokesRef([]);
    const { result } = renderHook(() => useTextNotes(strokes, onStrokes));

    act(() => {
      result.current.beginEditing({
        index: null,
        x: 0,
        y: 0,
        sx: 40,
        sy: 50,
        text: "move me",
        color: "#fff",
        round: 1,
      });
    });

    renderEditor(result, wrap);
    fireEvent.mouseDown(screen.getByTitle("Drag to move"), { clientX: 50, clientY: 60 });
    expect(result.current.editDragRef.current).toMatchObject({
      grabX: 50,
      grabY: 60,
      origSx: 40,
      origSy: 50,
    });
  });

  it("commits on blur and updates text while typing", async () => {
    const onStrokes = vi.fn();
    const strokes = strokesRef([]);
    const { result } = renderHook(() => useTextNotes(strokes, onStrokes));

    act(() => {
      result.current.beginEditing({
        index: null,
        x: 0,
        y: 0,
        sx: 0,
        sy: 0,
        text: "",
        color: "#fff",
        round: 1,
      });
    });

    renderEditor(result);
    const area = screen.getByPlaceholderText("Note");
    fireEvent.change(area, { target: { value: "saved on blur" } });
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    fireEvent.blur(area);
    expect(onStrokes).toHaveBeenCalledWith([
      expect.objectContaining({ type: "text", text: "saved on blur" }),
    ]);
  });
});
