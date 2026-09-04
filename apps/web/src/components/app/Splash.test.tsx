import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { deleteProject } from "@/lib/notes/projectStore";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { Splash } from "./Splash";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("@/lib/notes/projectStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notes/projectStore")>();
  return { ...actual, deleteProject: vi.fn() };
});

function savedProject(key = "proj-1"): ReviewProject {
  return {
    schema: 2,
    key,
    savedAt: Date.now(),
    fileName: "match.dem",
    mapName: "de_mirage",
    tick: 0,
    strokes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: "default",
    color: "#ff0000",
  };
}

function splashState(saved: ReviewProject[] = []) {
  const refreshSaved = vi.fn();
  return {
    session: {
      parsing: false,
      progress: null,
      parseFiles: null,
    },
    status: { error: null, notice: null },
    review: {
      saved,
      refreshSaved,
      exportNotes: vi.fn(),
      removeAllNotes: vi.fn(),
      tryOpenSaved: vi.fn().mockResolvedValue(null),
      linkDemoFile: vi.fn(),
    },
    onFiles: vi.fn(),
    refreshSaved,
  };
}

describe("Splash", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    vi.mocked(deleteProject).mockReset();
    vi.mocked(deleteProject).mockResolvedValue(undefined);
  });

  it("renders the drop zone splash", () => {
    vi.mocked(useApp).mockReturnValue(splashState() as unknown as ReturnType<typeof useApp>);
    render(<Splash />);
    expect(screen.getByText(/Drop one Counter-Strike 2/)).toBeInTheDocument();
  });

  it("deletes saved notes and refreshes the list", async () => {
    const state = splashState([savedProject("notes-key")]);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Splash />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteProject).toHaveBeenCalledWith("notes-key");
    await waitFor(() => expect(state.refreshSaved).toHaveBeenCalled());
  });
});
