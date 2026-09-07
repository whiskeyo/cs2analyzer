import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenPalette } from "./TokenPalette";

describe("TokenPalette", () => {
  it("marks the active tool and reports a change", () => {
    const onTool = vi.fn();
    const { rerender } = render(<TokenPalette tool="pan" onTool={onTool} />);
    expect(screen.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(onTool).toHaveBeenCalledWith("pen");
    fireEvent.click(screen.getByRole("button", { name: "CT pawn" }));
    expect(onTool).toHaveBeenCalledWith("pawn-ct");
    rerender(<TokenPalette tool="smoke" onTool={onTool} />);
    expect(screen.getByRole("button", { name: "Smoke" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Pan" }));
    expect(onTool).toHaveBeenCalledWith("pan");
  });

  it("draws icons instead of plaintext labels", () => {
    render(<TokenPalette tool="pan" onTool={() => undefined} />);
    expect(screen.getByRole("button", { name: "CT pawn" }).querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "T pawn" }).querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pen" }).querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Smoke" }).querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("smokegrenade"),
    );
    expect(screen.getByRole("button", { name: "Bomb" }).querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("planted_c4"),
    );
    expect(screen.queryByRole("button", { name: "CT pawn" })).not.toHaveTextContent("CT");
  });
});
