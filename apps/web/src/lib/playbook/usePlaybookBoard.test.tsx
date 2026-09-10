/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { emptyNote } from "@/lib/notes/note";
import { newPlaybook } from "./pages";
import { usePlaybookBoard } from "./usePlaybookBoard";

function setup() {
  const setNote = vi.fn();
  const setPalette = vi.fn();
  const history = {
    canUndo: true,
    canRedo: true,
    pushPresent: vi.fn(),
    undo: vi.fn(() => emptyNote()),
    redo: vi.fn(() => emptyNote()),
  };
  const book = newPlaybook("de_mirage", "A execs");
  const page = book.pages[0]!;
  const { result } = renderHook(() =>
    usePlaybookBoard({
      book,
      page,
      history,
      setNote,
      setPalette,
    }),
  );
  return { result, setNote, setPalette, history, book };
}

describe("usePlaybookBoard", () => {
  it("maps draw keys, nade preview, reset, and Escape", () => {
    const { result } = setup();
    fireEvent.keyDown(window, { key: "d" });
    expect(result.current.tool).toBe("pen");
    fireEvent.keyDown(window, { key: "n" });
    expect(result.current.nadeTrail).toBe(true);
    fireEvent.keyDown(window, { key: "g" });
    expect(result.current.nadeStyle).toBe("effect");
    const epoch = result.current.viewEpoch;
    fireEvent.keyDown(window, { key: "r" });
    expect(result.current.viewEpoch).toBe(epoch + 1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(result.current.tool).toBe("pan");
    expect(result.current.selectedId).toBeNull();
  });

  it("undoes and redoes through the history stack", () => {
    const { setNote, history } = setup();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(history.undo).toHaveBeenCalled();
    expect(setNote).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(history.redo).toHaveBeenCalled();
  });

  it("ignores tool keys while typing in a field", () => {
    const { result } = setup();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    fireEvent.keyDown(window, { key: "d" });
    expect(result.current.tool).toBe("pan");
    input.remove();
  });

  it("cycles palette and swatches from the open book", () => {
    const { setPalette, book } = setup();
    fireEvent.keyDown(window, { key: "]" });
    expect(setPalette).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "6" });
    expect(setPalette).toHaveBeenCalledWith(book.paletteId, expect.any(String));
  });
});
