import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenPalette } from "./TokenPalette";

const extra = {
  nadeTrail: false,
  onNadeTrail: vi.fn(),
  nadeStyle: "icon" as const,
  onNadeStyle: vi.fn(),
  paletteId: "neon",
  color: "#ff2d6a",
  onPalette: vi.fn(),
  onColor: vi.fn(),
  canUndo: false,
  canRedo: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onResetView: vi.fn(),
};

describe("TokenPalette", () => {
  it("marks the active tool and reports a change", () => {
    const onTool = vi.fn();
    const onNadeTrail = vi.fn();
    const onNadeStyle = vi.fn();
    const { rerender } = render(
      <TokenPalette
        tool="pan"
        onTool={onTool}
        {...extra}
        onNadeTrail={onNadeTrail}
        onNadeStyle={onNadeStyle}
      />,
    );
    expect(screen.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(onTool).toHaveBeenCalledWith("pen");
    fireEvent.click(screen.getByRole("button", { name: "CT pawn" }));
    expect(onTool).toHaveBeenCalledWith("pawn-ct");
    rerender(
      <TokenPalette
        tool="smoke"
        onTool={onTool}
        {...extra}
        onNadeTrail={onNadeTrail}
        onNadeStyle={onNadeStyle}
      />,
    );
    expect(screen.getByRole("button", { name: "Smoke" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pan" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Nade trail" }));
    expect(onNadeTrail).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Nade effect" }));
    expect(onNadeStyle).toHaveBeenCalledWith("effect");
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
  });

  it("keeps shared tools in the same order as Analyzer", () => {
    render(<TokenPalette tool="pan" onTool={() => undefined} {...extra} />);
    const toolbar = screen.getByRole("toolbar", { name: "Playbook tools" });
    const names = [...toolbar.querySelectorAll("button")].map(
      (el) => el.getAttribute("aria-label") ?? el.textContent,
    );
    expect(names.slice(0, 8)).toEqual([
      "Pan",
      "Pen",
      "Arrow",
      "Eraser",
      "Undo drawing (Ctrl+Z)",
      "Redo drawing (Ctrl+Y)",
      "Reset view",
      "Neon",
    ]);
  });

  it("draws icons instead of plaintext labels", () => {
    render(<TokenPalette tool="pan" onTool={() => undefined} {...extra} />);
    expect(screen.getByRole("button", { name: "CT pawn" }).querySelector("svg")).toHaveClass(
      "playbook-pawn-icon",
    );
    expect(screen.getByRole("button", { name: "T pawn" }).querySelector("svg")).toHaveClass(
      "playbook-pawn-icon",
    );
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
    expect(screen.getByRole("button", { name: "Reset view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neon" })).toBeInTheDocument();
  });
});
