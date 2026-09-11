import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { TestRouter } from "@/lib/testing/router";
import { en } from "@/lib/i18n/translations/en";
import { Home } from "./Home";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(async () => ({ de_mirage: UNIT_CALIBRATION })),
  };
});

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
    expect(screen.getByRole("heading", { name: en.home.title })).toBeInTheDocument();
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    const drop = container.querySelector(".drop");
    const intro = container.querySelector(".home-intro");
    expect(drop).toBeTruthy();
    expect(intro).toBeTruthy();
    if (drop && intro) {
      expect(intro.compareDocumentPosition(drop) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    expect(screen.queryByText(/Web Worker/)).not.toBeInTheDocument();
    expect(screen.queryByText(en.drop.savedTitle)).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Create a playbook/ })).toBeInTheDocument();
    expect(container.querySelector(".home-playbook-add")).toBeNull();
    expect(container.querySelector(".home-playbook-mark")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Pick a map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start empty board" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.home.faqLink })).toHaveAttribute("href", "/faq");
  });

  it("opens the create dialog from the playbook card", async () => {
    vi.mocked(useApp).mockReturnValue(homeState() as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter>
        <Home />
      </TestRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Create a playbook/ }));
    expect(await screen.findByRole("heading", { name: "New playbook" })).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Map" })).toHaveValue("de_mirage");
    expect(screen.getByRole("textbox", { name: "Playbook title" })).toBeInTheDocument();
  });
});
