import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenPalette } from "./TokenPalette";

describe("TokenPalette", () => {
  it("marks the active tool and reports a change", () => {
    const onTool = vi.fn();
    const { rerender } = render(<TokenPalette tool="pan" onTool={onTool} />);
    expect(screen.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "CT pawn" }));
    expect(onTool).toHaveBeenCalledWith("pawn-ct");
    rerender(<TokenPalette tool="smoke" onTool={onTool} />);
    expect(screen.getByRole("button", { name: "Smoke" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));
    expect(onTool).toHaveBeenCalledWith("pan");
  });
});
