import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_LAYERS } from "@/lib/notes/types";
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
      layers: { ...DEFAULT_LAYERS },
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
      onLayers: vi.fn(),
      onResetView: vi.fn(),
    },
    ...overrides,
  };
}

describe("MapToolbar", () => {
  it("renders drawing tools and layer toggles", () => {
    render(<MapToolbar {...toolbarProps()} />);
    expect(screen.getByRole("button", { name: "Draw" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nades" })).toHaveClass("on");
  });

  it("switches the active tool", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Draw" }));
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("pen");
  });

  it("stamps a bookmark when the bookmark tool is chosen", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /Bookmark this tick/ }));
    expect(props.reviewActions.onTool).toHaveBeenCalledWith("bookmark");
    expect(props.reviewActions.onStampBookmark).toHaveBeenCalled();
  });

  it("toggles radar layers", async () => {
    const props = toolbarProps();
    render(<MapToolbar {...props} />);
    const heatLayers = screen.getAllByRole("button", { name: "Heat" });
    await userEvent.click(heatLayers[heatLayers.length - 1]);
    expect(props.viewActions.onLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, heatmap: true });
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

    await userEvent.click(screen.getByRole("button", { name: "Shots" }));
    expect(props.viewActions.onLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, shots: false });

    await userEvent.click(screen.getByRole("button", { name: "Deaths" }));
    expect(props.viewActions.onLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, deaths: false });

    await userEvent.click(screen.getByRole("button", { name: "FK" }));
    expect(props.viewActions.onLayers).toHaveBeenCalledWith({
      ...DEFAULT_LAYERS,
      openings: false,
    });

    await userEvent.click(screen.getByRole("button", { name: "Names" }));
    expect(props.viewActions.onLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, names: false });

    await userEvent.click(screen.getByRole("button", { name: "Cone" }));
    expect(props.viewActions.onLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, cone: false });
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
});
