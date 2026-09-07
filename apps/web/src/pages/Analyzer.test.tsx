import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { deleteProject } from "@/lib/notes/projectStore";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { Analyzer } from "./Analyzer";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("@/lib/notes/projectStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notes/projectStore")>();
  return { ...actual, deleteProject: vi.fn() };
});

vi.mock("@/components/app/Viewer", () => ({
  Viewer: () => <div data-testid="viewer" />,
}));

function savedProject(key = "proj-1"): ReviewProject {
  return {
    schema: 2,
    key,
    savedAt: Date.now(),
    fileName: "match.dem",
    mapName: "de_mirage",
    tick: 0,
    notes: [],
    strokes: [],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: "default",
    color: "#ff0000",
  };
}

function analyzerState(saved: ReviewProject[] = []) {
  const refreshSaved = vi.fn();
  return {
    session: {
      parsing: false,
      progress: null,
      parseFiles: null,
      replay: null,
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

describe("Analyzer", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    vi.mocked(deleteProject).mockReset();
    vi.mocked(deleteProject).mockResolvedValue(undefined);
  });

  it("lists saved notes next to the drop zone", () => {
    vi.mocked(useApp).mockReturnValue(
      analyzerState([savedProject()]) as unknown as ReturnType<typeof useApp>,
    );
    render(<Analyzer />);
    expect(screen.getByText("Saved notes")).toBeInTheDocument();
    expect(screen.getByText("match.dem")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).not.toBeInTheDocument();
  });

  it("deletes saved notes and refreshes the list", async () => {
    const state = analyzerState([savedProject("notes-key")]);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Analyzer />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteProject).toHaveBeenCalledWith("notes-key");
    await waitFor(() => expect(state.refreshSaved).toHaveBeenCalled());
  });

  it("shows the viewer when a demo is loaded", () => {
    vi.mocked(useApp).mockReturnValue({
      ...analyzerState(),
      session: { ...analyzerState().session, replay: { header: { map_name: "de_mirage" } } },
    } as unknown as ReturnType<typeof useApp>);
    render(<Analyzer />);
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
    expect(screen.queryByText("Saved notes")).not.toBeInTheDocument();
  });
});
