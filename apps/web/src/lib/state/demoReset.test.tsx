import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResetOnDemoChange } from "./demoReset";

describe("useResetOnDemoChange", () => {
  it("runs reset on mount and when demo id changes", () => {
    const reset = vi.fn();
    const { rerender } = renderHook(({ id, enabled }) => useResetOnDemoChange(id, reset, enabled), {
      initialProps: { id: "a" as string | null, enabled: true },
    });
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ id: "a", enabled: true });
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ id: "b", enabled: true });
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("waits until enabled before resetting", () => {
    const reset = vi.fn();
    const { rerender } = renderHook(({ id, enabled }) => useResetOnDemoChange(id, reset, enabled), {
      initialProps: { id: "a" as string | null, enabled: false },
    });
    expect(reset).not.toHaveBeenCalled();

    rerender({ id: "a", enabled: true });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("clears tracking when demo id becomes null", () => {
    const reset = vi.fn();
    const { rerender } = renderHook(({ id }) => useResetOnDemoChange(id, reset), {
      initialProps: { id: "a" as string | null },
    });
    expect(reset).toHaveBeenCalledTimes(1);

    rerender({ id: null });
    rerender({ id: "a" });
    expect(reset).toHaveBeenCalledTimes(2);
  });
});
