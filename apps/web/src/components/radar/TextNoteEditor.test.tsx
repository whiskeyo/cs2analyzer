/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MutableRefObject } from "react";
import { emptyNote } from "@/lib/notes/note";
import type { Note } from "@/lib/notes/types";
import { TextNoteEditor, useTextNotes } from "./TextNoteEditor";

function noteRef(note: Note = emptyNote()): MutableRefObject<Note> {
  return { current: note };
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
    const onNote = vi.fn();
    const note = noteRef();
    const { result } = renderHook(() => useTextNotes(note, onNote));

    act(() => {
      result.current.beginEditing({
        ref: null,
        x: 1,
        y: 2,
        sx: 10,
        sy: 20,
        text: "hello",
        color: "#fff",
      });
    });

    renderEditor(result);
    await userEvent.type(screen.getByPlaceholderText("Note"), "{Enter}");
    expect(onNote).toHaveBeenCalledWith(
      expect.objectContaining({
        drawings: [expect.objectContaining({ type: "text", text: "hello", x: 1, y: 2 })],
      }),
    );
  });

  it("cancels editing on Escape", async () => {
    const onNote = vi.fn();
    const note = noteRef();
    const { result } = renderHook(() => useTextNotes(note, onNote));

    act(() => {
      result.current.beginEditing({
        ref: null,
        x: 0,
        y: 0,
        sx: 0,
        sy: 0,
        text: "draft",
        color: "#fff",
      });
    });

    renderEditor(result);
    await userEvent.type(screen.getByPlaceholderText("Note"), "{Escape}");
    expect(onNote).not.toHaveBeenCalled();
    expect(result.current.editing).toBeNull();
  });

  it("starts a drag from the grip handle", () => {
    const onNote = vi.fn();
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

    const note = noteRef();
    const { result } = renderHook(() => useTextNotes(note, onNote));

    act(() => {
      result.current.beginEditing({
        ref: null,
        x: 0,
        y: 0,
        sx: 40,
        sy: 50,
        text: "move me",
        color: "#fff",
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
    const onNote = vi.fn();
    const note = noteRef();
    const { result } = renderHook(() => useTextNotes(note, onNote));

    act(() => {
      result.current.beginEditing({
        ref: null,
        x: 0,
        y: 0,
        sx: 0,
        sy: 0,
        text: "",
        color: "#fff",
      });
    });

    renderEditor(result);
    const area = screen.getByPlaceholderText("Note");
    fireEvent.change(area, { target: { value: "saved on blur" } });
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    fireEvent.blur(area);
    expect(onNote).toHaveBeenCalledWith(
      expect.objectContaining({
        drawings: [expect.objectContaining({ type: "text", text: "saved on blur" })],
      }),
    );
  });
});
