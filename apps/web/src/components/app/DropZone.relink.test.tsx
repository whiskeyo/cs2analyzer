import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { PROJECT_SCHEMA, type ReviewProject } from "@/lib/notes/projectStore";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { TestRouter } from "@/lib/testing/router";
import { DropZone } from "./DropZone";

vi.mock("@/lib/parse/ensureParser", () => ({
  prefetchParser: vi.fn(),
}));

vi.mock("@/lib/notes/projectStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notes/projectStore")>();
  return {
    ...actual,
    demoFilePickerAvailable: vi.fn(() => true),
    pickOpenFiles: vi.fn(),
    pickDemoFileHandle: vi.fn(),
  };
});

import { demoFilePickerAvailable, pickDemoFileHandle } from "@/lib/notes/projectStore";

function render(ui: ReactElement) {
  return rtlRender(<TestRouter>{ui}</TestRouter>);
}

function props(overrides: Partial<Parameters<typeof DropZone>[0]> = {}) {
  return {
    onFiles: () => {},
    onDeleteNotes: () => {},
    onTryOpenSaved: async () => null,
    onLinkDemoFile: () => {},
    parsing: false,
    progress: null,
    parseFiles: null,
    error: null,
    notice: null,
    saved: [],
    showSavedNotes: true,
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
    notes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
    linkedFileLabel: "a.dem",
    ...overrides,
  };
}

describe("DropZone notes re-link", () => {
  beforeEach(() => {
    vi.mocked(demoFilePickerAvailable).mockReturnValue(true);
    vi.mocked(pickDemoFileHandle).mockResolvedValue(null);
  });

  it("prompts to re-pick when a linked demo lost file permission", async () => {
    const onFiles = vi.fn();
    const file = new File(["fake"], "a.dem");
    vi.mocked(pickDemoFileHandle).mockResolvedValue({
      name: "a.dem",
      getFile: async () => file,
    } as FileSystemFileHandle);
    render(<DropZone {...props({ saved: [savedProject()], onFiles })} />);

    await userEvent.click(screen.getByText("a.dem"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("no longer has permission to read the linked demo");
    expect(dialog).toHaveTextContent("Pick a.dem again");

    await userEvent.click(screen.getByRole("button", { name: "Pick demo" }));
    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([file]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the restore modal open when the re-picked file name does not match", async () => {
    const onFiles = vi.fn();
    vi.mocked(pickDemoFileHandle).mockResolvedValue({
      name: "other.dem",
      getFile: async () => new File(["x"], "other.dem"),
    } as FileSystemFileHandle);
    render(<DropZone {...props({ saved: [savedProject()], onFiles })} />);

    await userEvent.click(screen.getByText("a.dem"));
    await userEvent.click(screen.getByRole("button", { name: "Pick demo" }));
    expect(screen.getByText("Pick a.dem — selected other.dem.")).toBeInTheDocument();
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
