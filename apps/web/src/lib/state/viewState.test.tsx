/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_LAYERS } from "@/lib/notes/types";
import type { DefaultDrawTool } from "@/lib/settings/userSettings";
import { useViewState } from "./viewState";

describe("useViewState", () => {
  it("resets selection, overlays, tool, and camera epoch when the demo changes", () => {
    const { result, rerender } = renderHook(({ id }) => useViewState(id), {
      initialProps: { id: "a" as string | null },
    });
    act(() => {
      result.current.select(2);
      result.current.setFollow(true);
      result.current.setTrails(true);
      result.current.setMoment(true);
      result.current.setTool("eraser");
      result.current.setLayers({ ...DEFAULT_LAYERS, names: false });
    });
    const epoch = result.current.viewEpoch;
    rerender({ id: "b" });
    expect(result.current.selected).toBeNull();
    expect(result.current.follow).toBe(false);
    expect(result.current.trails).toBe(false);
    expect(result.current.moment).toBe(false);
    expect(result.current.tool).toBe("pan");
    expect(result.current.layers).toEqual(DEFAULT_LAYERS);
    expect(result.current.viewEpoch).toBe(epoch + 1);
  });

  it("applies settings default layers on a new demo, not the previous session toggles", () => {
    const custom = { ...DEFAULT_LAYERS, names: false, heatmap: true };
    const { result, rerender } = renderHook(({ id, layers }) => useViewState(id, layers), {
      initialProps: { id: "a" as string | null, layers: custom },
    });
    expect(result.current.layers).toEqual(custom);
    act(() => {
      result.current.setLayers({ ...DEFAULT_LAYERS, cone: false });
    });
    rerender({ id: "b", layers: custom });
    expect(result.current.layers).toEqual(custom);
  });

  it("applies the settings default draw tool on a new demo", () => {
    const { result, rerender } = renderHook(
      ({ id, tool }) => useViewState(id, DEFAULT_LAYERS, tool),
      {
        initialProps: { id: "a" as string | null, tool: "pen" as const },
      },
    );
    expect(result.current.tool).toBe("pen");
    act(() => {
      result.current.setTool("eraser");
    });
    rerender({ id: "b", tool: "pen" });
    expect(result.current.tool).toBe("pen");
  });

  it("keeps the current draw tool when only the settings default changes", () => {
    const { result, rerender } = renderHook(({ tool }) => useViewState("a", DEFAULT_LAYERS, tool), {
      initialProps: { tool: "pan" as DefaultDrawTool },
    });
    act(() => {
      result.current.setTool("eraser");
    });
    rerender({ tool: "pen" });
    expect(result.current.tool).toBe("eraser");
  });

  it("keeps per-demo layer toggles when settings defaults change", () => {
    const custom = { ...DEFAULT_LAYERS, names: false, heatmap: true };
    const { result, rerender } = renderHook(({ layers }) => useViewState("a", layers), {
      initialProps: { layers: DEFAULT_LAYERS },
    });
    act(() => {
      result.current.setLayers({ ...DEFAULT_LAYERS, cone: false });
    });
    rerender({ layers: custom });
    expect(result.current.layers).toEqual({ ...DEFAULT_LAYERS, cone: false });
  });

  it("clears follow through setSelected so Esc matches a radar deselect", () => {
    const { result } = renderHook(() => useViewState("a"));
    act(() => {
      result.current.select(1);
      result.current.setFollow(true);
    });
    act(() => {
      result.current.setSelected(null);
    });
    expect(result.current.selected).toBeNull();
    expect(result.current.follow).toBe(false);
  });
});
