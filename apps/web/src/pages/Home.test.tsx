import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useApp } from "@/lib/state/appState";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { TestRouter } from "@/lib/testing/router";
import { Home } from "./Home";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
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
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: "default",
    color: "#ff0000",
  };
}

function homeState(saved: ReviewProject[] = []) {
  return {
    session: {
      parsing: false,
      progress: null,
      parseFiles: null,
    },
    status: { error: null, notice: null },
    review: {
      saved,
      refreshSaved: vi.fn(),
      exportNotes: vi.fn(),
      removeAllNotes: vi.fn(),
      tryOpenSaved: vi.fn().mockResolvedValue(null),
      linkDemoFile: vi.fn(),
    },
    onFiles: vi.fn(),
  };
}

describe("Home", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders the drop zone with a product intro and no saved notes", () => {
    vi.mocked(useApp).mockReturnValue(
      homeState([savedProject()]) as unknown as ReturnType<typeof useApp>,
    );
    const { container } = render(
      <TestRouter>
        <Home />
      </TestRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    const drop = container.querySelector(".drop");
    const intro = container.querySelector(".home-intro");
    expect(drop).toBeTruthy();
    expect(intro).toBeTruthy();
    if (drop && intro) {
      expect(intro.compareDocumentPosition(drop) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    expect(screen.queryByText(/Web Worker/)).not.toBeInTheDocument();
    expect(screen.queryByText("Saved notes")).not.toBeInTheDocument();
    expect(screen.queryByText("match.dem")).not.toBeInTheDocument();
  });

  it("offers Playbook and FAQ shortcuts next to the drop zone", () => {
    vi.mocked(useApp).mockReturnValue(homeState() as unknown as ReturnType<typeof useApp>);
    const { container } = render(
      <TestRouter>
        <Home />
      </TestRouter>,
    );
    const drop = container.querySelector(".drop");
    const playbook = container.querySelector(".home-playbook");
    const faq = container.querySelector(".home-faq-hint");
    expect(drop).toBeTruthy();
    expect(playbook).toBeTruthy();
    expect(faq).toBeTruthy();
    if (drop && playbook) {
      expect(drop.compareDocumentPosition(playbook) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    if (playbook && faq) {
      expect(playbook.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    expect(screen.getByRole("link", { name: "Pick a map" })).toHaveAttribute("href", "/playbook");
    expect(screen.getByRole("link", { name: "Start empty board" })).toHaveAttribute(
      "href",
      "/playbook?map=de_mirage",
    );
    expect(screen.getByRole("link", { name: "see the FAQ" })).toHaveAttribute("href", "/faq");
  });
});
