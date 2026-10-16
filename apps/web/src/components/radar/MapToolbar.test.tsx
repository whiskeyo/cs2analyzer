import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MATCH_PDF_BOOKMARK_TOOLTIP } from "@/lib/export/constants";
import type { MapToolbarProps } from "./mapToolbarTypes";
import { MapToolbar } from "./MapToolbar";

function toolbarProps(overrides: Partial<MapToolbarProps> = {}): MapToolbarProps {
  return {
    review: {
      tool: "pan",
      color: "#ff0000",
      paletteId: "default",
      floorMode: "auto",
      hasFloors: true,
      canUndo: true,
      canRedo: false,
    },
    view: {
      follow: false,
      trails: true,
      moment: false,
      canFollow: true,
    },
    reviewActions: {
      onTool: vi.fn(),
      onColor: vi.fn(),
      onPalette: vi.fn(),
      onFloorMode: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onClear: vi.fn(),
      onStampBookmark: vi.fn(),
    },
    viewActions: {
      onFollow: vi.fn(),
      onTrails: vi.fn(),
      onMoment: vi.fn(),
      onResetView: vi.fn(),
    },
    ...overrides,
  };
}

describe("MapToolbar", () => {
  it("renders drawing tools without overlay toggles", () => {
    render(<MapToolbar {...toolbarProps()} />);
    expect(screen.getByRole("toolbar", { name: "Draw tools" })).toHaveAttribute(
      "data-tutorial",
      "draw",
    );
    expect(screen.getByRole("button", { name: "Draw" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Legend" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Nades" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stats timeline" })).not.toBeInTheDocument();
  });

  it("switches the active tool", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Draw" }));
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("pen");
  });

  it("disables drawing tools when drawings are not live", async () => {
    const props = toolbarProps({ drawingsEnabled: false });
    render(<MapToolbar {...props} />);
    expect(screen.getByRole("button", { name: "Draw" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Arrow" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Text note" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pan" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Draw" }));
    expect(props.reviewActions.onTool).not.toHaveBeenCalled();
  });

  it("stamps a bookmark when the bookmark tool is chosen", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);
    const bookmark = screen.getByRole("button", {
      name: MATCH_PDF_BOOKMARK_TOOLTIP,
    });
    expect(bookmark).toHaveAttribute("title", MATCH_PDF_BOOKMARK_TOOLTIP);
    await userEvent.click(bookmark);
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("bookmark");
    expect(props.reviewActions.onStampBookmark).toHaveBeenCalled();
  });

  it("puts the stats timeline in the overlay slot", async () => {
    const onToggle = vi.fn();
    render(<MapToolbar {...toolbarProps({ statsTimeline: { open: false, onToggle } })} />);
    expect(screen.queryByRole("button", { name: "Nades" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Stats timeline" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", "Stats timeline");
    expect(button.previousElementSibling).toHaveClass("toolbar-sep");
    const glyph = button.querySelector("path");
    expect(glyph).toHaveAttribute("stroke", "currentColor");
    expect(glyph).toHaveAttribute("stroke-linecap", "round");
    expect(glyph).toHaveAttribute(
      "d",
      "M3 2.5v11h11M4.5 10.75 7 6.75 8.75 8.5 12.5 3.75M10 3.75h2.5v2.5",
    );
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("switches floor mode when the map has lower radar", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Lower" }));
    expect(props.reviewActions.onFloorMode).toHaveBeenCalledWith("lower");
  });

  it("picks colors and calls redo when available", async () => {
    const props = toolbarProps({
      review: {
        ...toolbarProps().review,
        canRedo: true,
        color: "#ff0000",
      },
    });
    render(<MapToolbar {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Redo drawing (Ctrl+Y)" }));
    expect(props.reviewActions.onRedo).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "#ffe600" }));
    expect(props.reviewActions.onColor).toHaveBeenCalledWith("#ffe600");
  });

  it("toggles follow, trails, moment, and more layers", async () => {
    const props = toolbarProps({
      view: {
        ...toolbarProps().view,
        canFollow: true,
        follow: false,
        trails: true,
        moment: false,
      },
    });
    render(<MapToolbar {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Track player" }));
    expect(props.viewActions.onFollow).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByRole("button", { name: "Trail" }));
    expect(props.viewActions.onTrails).toHaveBeenCalledWith(false);

    await userEvent.click(screen.getByTitle(/Moment: new drawings/));
    expect(props.viewActions.onMoment).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(props.viewActions.onResetView).toHaveBeenCalled();
  });

  it("selects arrow, text, and eraser tools", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Arrow" }));
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("arrow");

    await userEvent.click(screen.getByRole("button", { name: "Text note" }));
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("text");

    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("eraser");

    await userEvent.click(screen.getByRole("button", { name: "Clear drawings on this round" }));
    expect(props.reviewActions.onClear).toHaveBeenCalled();
  });

  it("calls onSnapshot when the snapshot button is used", async () => {
    const onSnapshot = vi.fn();
    render(<MapToolbar {...toolbarProps({ onSnapshot })} />);
    await userEvent.click(screen.getByRole("button", { name: "Snapshot to playbook" }));
    expect(onSnapshot).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Snapshot to playbook" }).closest("[data-tutorial]"),
    ).toHaveAttribute("data-tutorial", "snapshot");
  });

  it("hides snapshot when the handler is omitted", () => {
    render(<MapToolbar {...toolbarProps()} />);
    expect(screen.queryByRole("button", { name: "Snapshot to playbook" })).not.toBeInTheDocument();
  });
});
