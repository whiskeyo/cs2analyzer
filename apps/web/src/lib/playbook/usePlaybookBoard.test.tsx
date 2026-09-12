/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { emptyNote } from "@/lib/notes/note";
import { makePiece } from "./pieces";
import { newPlaybook, type PlaybookFloorLayer } from "./pages";
import type { PlaybookPage } from "./types";
import { usePlaybookBoard } from "./usePlaybookBoard";

function setup(
  defaultToolOrOpts?:
    | "pan"
    | "pen"
    | { floorLayer?: PlaybookFloorLayer; page?: PlaybookPage; defaultTool?: "pan" | "pen" },
) {
  const opts =
    typeof defaultToolOrOpts === "string" || defaultToolOrOpts == null
      ? { defaultTool: defaultToolOrOpts }
      : defaultToolOrOpts;
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
  const page = opts.page ?? book.pages[0]!;
  const { result, rerender } = renderHook(
    ({ book: nextBook, tool, floorLayer, page: nextPage }) =>
      usePlaybookBoard({
        book: nextBook,
        page: nextPage,
        floorLayer,
        history,
        setNote,
        setPalette,
        defaultTool: tool,
      }),
    {
      initialProps: {
        book,
        tool: opts.defaultTool,
        floorLayer: opts.floorLayer,
        page,
      },
    },
  );
  return { result, rerender, setNote, setPalette, history, book };
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

  it("starts a new playbook on the settings default draw tool", () => {
    const { result } = setup("pen");
    expect(result.current.tool).toBe("pen");
  });

  it("applies the default tool when a new playbook opens, not when the setting changes", () => {
    const { result, rerender, book } = setup("pan");
    fireEvent.keyDown(window, { key: "a" });
    expect(result.current.tool).toBe("arrow");
    rerender({ book, tool: "pen" });
    expect(result.current.tool).toBe("arrow");
    const next = newPlaybook("de_mirage", "B execs");
    rerender({ book: next, tool: "pen" });
    expect(result.current.tool).toBe("pen");
  });

  it("cycles palette and swatches from the open book", () => {
    const { setPalette, book } = setup();
    fireEvent.keyDown(window, { key: "]" });
    expect(setPalette).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "6" });
    expect(setPalette).toHaveBeenCalledWith(book.paletteId, expect.any(String));
  });

  it("builds the pawn legend from the current floor note", () => {
    const book = newPlaybook("de_nuke", "Nuke execs");
    const page = book.pages[0]!;
    page.note.pieces.push(makePiece("pawn", 0, 0, { label: "upperA", color: "#ff2d6a" }));
    page.lowerNote.pieces.push(
      makePiece("pawn", 1, 0, { label: "donk", color: "#ff2d6a" }),
      makePiece("pawn", 2, 0, { label: "m0NESY", color: "#00f0ff" }),
    );
    const upper = setup({ page, floorLayer: "upper" });
    expect(upper.result.current.legend).toEqual([]);
    const lower = setup({ page, floorLayer: "lower" });
    expect(lower.result.current.legend).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
  });
});
