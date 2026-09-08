import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LayoutToolbar } from "./LayoutToolbar";

describe("LayoutToolbar", () => {
  it("picks tools and floors", async () => {
    const onTool = vi.fn();
    const onFloor = vi.fn();
    const onResetView = vi.fn();
    render(
      <LayoutToolbar
        tool="polygon"
        floor="default"
        hasFloors
        onTool={onTool}
        onFloor={onFloor}
        onResetView={onResetView}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pan (1)" }));
    expect(onTool).toHaveBeenCalledWith("pan");
    await userEvent.click(
      screen.getByRole("button", { name: "Polygon (2) — click vertices, Enter closes" }),
    );
    expect(onTool).toHaveBeenCalledWith("polygon");
    await userEvent.click(screen.getByRole("button", { name: "Rect (3) — drag" }));
    expect(onTool).toHaveBeenCalledWith("rect");
    await userEvent.click(screen.getByRole("button", { name: "Circle (4) — drag" }));
    expect(onTool).toHaveBeenCalledWith("circle");
    await userEvent.click(screen.getByRole("button", { name: "Select (5)" }));
    expect(onTool).toHaveBeenCalledWith("select");
    await userEvent.click(screen.getByRole("button", { name: "Lower" }));
    expect(onFloor).toHaveBeenCalledWith("lower");
    await userEvent.click(screen.getByRole("button", { name: "Upper" }));
    expect(onFloor).toHaveBeenCalledWith("default");
    await userEvent.click(screen.getByRole("button", { name: "Reset view (R)" }));
    expect(onResetView).toHaveBeenCalled();
  });

  it("hides floor picks on single-level maps", () => {
    render(
      <LayoutToolbar
        tool="select"
        floor="default"
        hasFloors={false}
        onTool={vi.fn()}
        onFloor={vi.fn()}
        onResetView={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Upper" })).not.toBeInTheDocument();
  });
});
