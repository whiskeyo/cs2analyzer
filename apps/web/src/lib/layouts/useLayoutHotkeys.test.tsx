import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useLayoutHotkeys } from "./useLayoutHotkeys";
import { emptyLayout } from "./layout";
import { poly } from "@/lib/layouts/testing/callouts";
import type { LayoutTool } from "./useLayoutPointer";

function setup(selected: string[] = ["a", "b"]) {
  const closeDraft = vi.fn();
  const cancelDraft = vi.fn();
  const save = vi.fn();
  const onCallouts = vi.fn();
  const clearSelection = vi.fn();
  const deleteCallouts = vi.fn();
  const pickTool = vi.fn<(tool: LayoutTool) => void>();
  const resetView = vi.fn();
  const selectedIdsRef = { current: selected };
  const layoutRef = {
    current: {
      ...emptyLayout("de_mirage"),
      callouts: [poly("a", "A", { group: "G" }), poly("b", "B", { group: "G" }), poly("c")],
    },
  };
  renderHook(() =>
    useLayoutHotkeys({
      closeDraft,
      cancelDraft,
      save,
      selectedIdsRef,
      layoutRef,
      onCallouts,
      clearSelection,
      deleteCallouts,
      pickTool,
      resetView,
    }),
  );
  return {
    closeDraft,
    cancelDraft,
    save,
    onCallouts,
    clearSelection,
    deleteCallouts,
    pickTool,
    resetView,
  };
}

describe("useLayoutHotkeys", () => {
  it("saves on Ctrl+S and ignores shortcuts while typing", () => {
    const h = setup();
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(h.save).toHaveBeenCalled();

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    fireEvent.keyDown(window, { key: "2" });
    expect(h.pickTool).not.toHaveBeenCalled();
    input.remove();
  });

  it("closes, cancels, deletes, groups, ungroups, and picks tools", () => {
    const h = setup();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(h.closeDraft).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.cancelDraft).toHaveBeenCalled();
    expect(h.clearSelection).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(h.deleteCallouts).toHaveBeenCalledWith(["a", "b"]);
    fireEvent.keyDown(window, { key: "g" });
    expect(h.onCallouts).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "u" });
    expect(h.onCallouts).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: "3" });
    expect(h.pickTool).toHaveBeenCalledWith("rect");
    fireEvent.keyDown(window, { key: "r" });
    expect(h.resetView).toHaveBeenCalled();
  });

  it("does not group a single selection", () => {
    const h = setup(["a"]);
    fireEvent.keyDown(window, { key: "g" });
    expect(h.onCallouts).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "u" });
    expect(h.onCallouts).not.toHaveBeenCalled();
  });

  it("saves on Meta+S, deletes with Backspace, and ignores other modifiers", () => {
    const h = setup();
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(h.save).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(h.deleteCallouts).toHaveBeenCalledWith(["a", "b"]);
    fireEvent.keyDown(window, { key: "2", altKey: true });
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });
    expect(h.pickTool).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "4" });
    fireEvent.keyDown(window, { key: "5" });
    expect(h.pickTool).toHaveBeenCalledWith("pan");
    expect(h.pickTool).toHaveBeenCalledWith("circle");
    expect(h.pickTool).toHaveBeenCalledWith("select");
  });
});
