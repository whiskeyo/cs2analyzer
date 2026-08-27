import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PROJECT_SCHEMA, type ReviewProject } from "@/lib/notes/projectStore";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { DropZone } from "./DropZone";

const noop = () => {};

function props(overrides: Partial<Parameters<typeof DropZone>[0]> = {}) {
  return {
    onFile: noop,
    onExportNotes: noop,
    onDeleteNotes: noop,
    onWantDemo: noop,
    parsing: false,
    progress: null,
    error: null,
    notice: null,
    saved: [],
    ...overrides,
  };
}

function savedProject(overrides: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: PROJECT_SCHEMA,
    key: "de_mirage|1|50,100|a.dem",
    savedAt: Date.now(),
    fileName: "a.dem",
    mapName: "de_mirage",
    tick: 120,
    strokes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
    ...overrides,
  };
}

describe("DropZone", () => {
  it("hands a picked demo to the parser", async () => {
    const onFile = vi.fn();
    const { container } = render(<DropZone {...props({ onFile })} />);

    const input = container.querySelector("input[type=file]");
    const demo = new File(["fake"], "match.dem");
    await userEvent.upload(input as HTMLInputElement, demo);

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0].name).toBe("match.dem");
  });

  it("shows parse progress as a percentage", () => {
    render(<DropZone {...props({ parsing: true, progress: { current: 25, total: 200 } })} />);
    expect(screen.getByText("13%")).toBeInTheDocument();
  });

  it("keeps the progress bar hidden until a parse starts", () => {
    render(<DropZone {...props()} />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("surfaces parse errors and notices", () => {
    render(
      <DropZone {...props({ error: "Supports only Source 2 replays", notice: "Restored" })} />,
    );
    expect(screen.getByText("Supports only Source 2 replays")).toBeInTheDocument();
    expect(screen.getByText("Restored")).toBeInTheDocument();
  });

  it("lists saved notes and asks for the demo that matches them", async () => {
    const onWantDemo = vi.fn();
    render(<DropZone {...props({ saved: [savedProject()], onWantDemo })} />);

    expect(screen.getByText("Mirage")).toBeInTheDocument();
    await userEvent.click(screen.getByText("a.dem"));
    expect(onWantDemo).toHaveBeenCalledWith("a.dem");
  });

  it("deletes saved notes by key", async () => {
    const onDeleteNotes = vi.fn();
    render(<DropZone {...props({ saved: [savedProject()], onDeleteNotes })} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteNotes).toHaveBeenCalledWith("de_mirage|1|50,100|a.dem");
  });

  it("disables the notes export until something is saved", () => {
    const { rerender } = render(<DropZone {...props()} />);
    expect(screen.getByRole("button", { name: "Export notes" })).toBeDisabled();

    rerender(<DropZone {...props({ saved: [savedProject()] })} />);
    expect(screen.getByRole("button", { name: "Export notes" })).toBeEnabled();
  });
});
