/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playbookHref } from "@/lib/app/playbookSearch";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { emptyNote } from "@/lib/notes/note";
import { COPY_SUFFIX, UNTITLED_STRAT } from "@/lib/playbook/types";
import { PLAYBOOK_FOCUS_KEY, rememberPlaybookFocus } from "@/lib/playbook/focus";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import { makePiece } from "@/lib/playbook/pieces";
import {
  createPlaybook,
  deleteAllPlaybooks,
  loadPlaybook,
  savePlaybook,
} from "@/lib/playbook/playbookStore";
import { TestRouter } from "@/lib/testing/router";
import { Playbook } from "./Playbook";

function renderBoard(path = "/playbook") {
  return render(
    <TestRouter path={path}>
      <Playbook />
    </TestRouter>,
  );
}

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(),
  };
});

vi.mock("@/components/playbook/PlaybookCanvas", () => ({
  PlaybookCanvas: ({
    floorMode,
    note,
  }: {
    floorMode: string;
    note: { pieces: unknown[]; drawings: unknown[] };
  }) => (
    <div
      data-testid="playbook-canvas"
      data-floor={floorMode}
      data-pieces={String(note.pieces.length)}
      data-drawings={String(note.drawings.length)}
    />
  ),
}));

const downloadPlaybookPdf = vi.hoisted(() => vi.fn());

vi.mock("@/lib/export/exportPlaybook", () => ({
  downloadPlaybookPdf,
}));

import { loadCalibrations } from "@/lib/radar/maps";

async function createBookFromMap(mapLabel = "Mirage") {
  fireEvent.contextMenu(await screen.findByRole("button", { name: mapLabel }));
  await userEvent.click(screen.getByRole("menuitem", { name: "New playbook" }));
  await screen.findByTestId("playbook-canvas");
}

async function stratMenu(title: string, item: string) {
  fireEvent.contextMenu(screen.getByRole("button", { name: title }));
  await userEvent.click(screen.getByRole("menuitem", { name: item }));
}

describe("Playbook", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    vi.mocked(loadCalibrations).mockReset();
    vi.mocked(loadCalibrations).mockResolvedValue({
      de_inferno: UNIT_CALIBRATION,
      de_mirage: UNIT_CALIBRATION,
      de_dust2: UNIT_CALIBRATION,
    });
    downloadPlaybookPdf.mockReset();
    downloadPlaybookPdf.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
  });

  it("picks a map, creates a book, and opens the board", async () => {
    renderBoard();
    expect(await screen.findByRole("button", { name: "Mirage" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Inferno" }));
    await createBookFromMap("Inferno");
    fireEvent.keyDown(screen.getByRole("button", { name: "Untitled playbook" }), { key: "F2" });
    fireEvent.change(screen.getByRole("textbox", { name: "Book title" }), {
      target: { value: "A execs" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Book title" }));
    expect(screen.getByRole("separator", { name: "Resize playbook tree" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize strat panel" })).toBeInTheDocument();
    const root = document.querySelector(".playbook");
    expect(root?.firstElementChild).toHaveClass("playbook-stage");
    expect(root?.querySelector(".playbook-detail")).toBeTruthy();
    expect(root?.lastElementChild).toHaveClass("playbook-tree-pane");
    fireEvent.keyDown(screen.getByRole("button", { name: "A execs" }), {
      key: "F2",
    });
    expect(screen.getByRole("textbox", { name: "Book title" })).toHaveValue("A execs");
    fireEvent.change(screen.getByRole("textbox", { name: "Book title" }), {
      target: { value: "Anti strats" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Book title" }));
    expect(screen.getByRole("button", { name: "Anti strats" })).toHaveClass("is-active");
  });

  it("exports a local PDF from the playbook context menu", async () => {
    renderBoard();
    await createBookFromMap();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled playbook" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Export PDF" }));
    expect(screen.getByRole("dialog", { name: "Export PDF" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "With photos" }));
    await waitFor(() => expect(downloadPlaybookPdf).toHaveBeenCalledTimes(1));
    expect(downloadPlaybookPdf.mock.calls[0]?.[0]).toMatchObject({
      title: "Untitled playbook",
      mapName: "de_mirage",
    });
    expect(downloadPlaybookPdf.mock.calls[0]?.[1]).toBe(UNIT_CALIBRATION);
    expect(downloadPlaybookPdf.mock.calls[0]?.[3]).toBe("dark");
    expect(downloadPlaybookPdf.mock.calls[0]?.[4]).toBe(DEFAULT_RADAR_GRAY);
    expect(downloadPlaybookPdf.mock.calls[0]?.[5]).toBe(true);
  });

  it("exports a PDF without embedded photos when that choice is picked", async () => {
    renderBoard();
    await createBookFromMap();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled playbook" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Export PDF" }));
    await userEvent.click(screen.getByRole("button", { name: "Without photos" }));
    await waitFor(() => expect(downloadPlaybookPdf).toHaveBeenCalledTimes(1));
    expect(downloadPlaybookPdf.mock.calls[0]?.[5]).toBe(false);
  });

  it("shows an error when playbook PDF export fails", async () => {
    downloadPlaybookPdf.mockRejectedValue(new Error("encode failed"));
    renderBoard();
    await createBookFromMap();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled playbook" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Export PDF" }));
    await userEvent.click(screen.getByRole("button", { name: "With photos" }));
    expect(await screen.findByText("Could not export PDF.")).toBeInTheDocument();
  });

  it("adds, switches, duplicates, and deletes strats including the last one", async () => {
    renderBoard();
    await createBookFromMap();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled playbook" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New strat" }));
    const strats = screen.getAllByRole("button", { name: "Untitled strat" });
    expect(strats.length).toBeGreaterThanOrEqual(2);
    const activeUntitled = strats.find((el) => el.classList.contains("is-active")) ?? strats.at(-1);
    fireEvent.doubleClick(activeUntitled!);
    fireEvent.change(screen.getByRole("textbox", { name: "Strat name" }), {
      target: { value: "A exec" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Strat name" }));
    expect(screen.getByRole("button", { name: "A exec" })).toHaveClass("is-active");

    const untitled = screen.getAllByRole("button", {
      name: "Untitled strat",
    })[0];
    await userEvent.click(untitled!);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Untitled strat" }));
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue("Untitled strat");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Strat name" }), {
      key: "Escape",
    });

    await userEvent.click(screen.getByRole("button", { name: "A exec" }));
    await stratMenu("A exec", "Duplicate strat");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: `A exec${COPY_SUFFIX}` })).toHaveClass("is-active");
    });

    await stratMenu(`A exec${COPY_SUFFIX}`, "Delete strat");
    expect(screen.queryByRole("button", { name: `A exec${COPY_SUFFIX}` })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "A exec" }));
    await stratMenu("A exec", "Delete strat");
    await stratMenu("Untitled strat", "Delete strat");
    fireEvent.doubleClick(screen.getByRole("button", { name: "Untitled strat" }));
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue("Untitled strat");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Strat name" }), {
      key: "Escape",
    });
    expect(screen.getByTestId("playbook-canvas")).toBeInTheDocument();
  });

  it("lets a title stay empty until blur and keeps spaces while typing", async () => {
    renderBoard();
    await createBookFromMap();
    fireEvent.keyDown(await screen.findByRole("button", { name: "Untitled playbook" }), {
      key: "F2",
    });
    const title = screen.getByRole("textbox", { name: "Book title" });
    fireEvent.change(title, { target: { value: "" } });
    expect(title).toHaveValue("");
    fireEvent.change(title, { target: { value: "Mid hold" } });
    expect(title).toHaveValue("Mid hold");
    fireEvent.blur(title);
    expect(screen.getByRole("button", { name: "Mid hold" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Mid hold" }), {
      key: "F2",
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Book title" }), {
      target: { value: "   " },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Book title" }));
    expect(screen.getByRole("button", { name: "Untitled playbook" })).toBeInTheDocument();
  });

  it("keeps the previous playbook's strats visible when another book is selected", async () => {
    const first = await createPlaybook("de_mirage", "A execs");
    const second = await createPlaybook("de_mirage", "B defaults");
    await savePlaybook({
      ...first,
      pages: [{ ...first.pages[0]!, title: "A smoke" }],
    });
    await savePlaybook({
      ...second,
      pages: [{ ...second.pages[0]!, title: "B hold" }],
    });
    renderBoard();
    await userEvent.click(await screen.findByRole("button", { name: "A execs" }));
    expect(await screen.findByRole("button", { name: "A smoke" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "B defaults" }));
    expect(await screen.findByRole("button", { name: "B hold" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "B defaults" })).toHaveClass("is-active");
    });
    expect(screen.getByRole("button", { name: "A smoke" })).toBeInTheDocument();
  });

  it("keeps playbook order when switching the active book", async () => {
    await createPlaybook("de_mirage", "First");
    await createPlaybook("de_mirage", "Second");
    renderBoard();
    const first = await screen.findByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(second);
    expect(screen.getByRole("button", { name: "Second" })).toHaveClass("is-active");
    const firstAfter = screen.getByRole("button", { name: "First" });
    const secondAfter = screen.getByRole("button", { name: "Second" });
    expect(
      firstAfter.compareDocumentPosition(secondAfter) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.contextMenu(screen.getByRole("button", { name: "First" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    await waitFor(() => {
      const movedFirst = screen.getByRole("button", { name: "First" });
      const movedSecond = screen.getByRole("button", { name: "Second" });
      expect(
        movedSecond.compareDocumentPosition(movedFirst) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("shows token tools, nade modes, and strat notes instead of a text box", async () => {
    renderBoard();
    await createBookFromMap();
    expect(await screen.findByRole("toolbar", { name: "Playbook tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nade trail" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nade effect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "On radar (0)" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await userEvent.click(screen.getByRole("button", { name: "On radar (0)" }));
    expect(screen.getByText(/Nothing on the radar yet/)).toBeInTheDocument();
    const notes = screen.getByRole("textbox", { name: "Strat notes" });
    await userEvent.click(notes);
    await userEvent.paste("smoke CT, flash palace");
    expect(notes).toHaveTextContent("smoke CT, flash palace");
    expect(screen.queryByRole("textbox", { name: "YouTube link" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add playbook image")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "YouTube" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Image" })).toBeInTheDocument();
    expect(screen.getByText(/Place a YouTube pin/)).toBeInTheDocument();
    const youtubeBtn = screen.getByRole("button", { name: "YouTube" });
    const imageBtn = screen.getByRole("button", { name: "Image" });
    expect(
      youtubeBtn.compareDocumentPosition(imageBtn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      youtubeBtn.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Flash" }));
    expect(screen.getByRole("button", { name: "Flash" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Reset view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neon" })).toBeInTheDocument();
    expect(document.querySelector(".keys")).toHaveTextContent("V pan");
  });

  it("switches upper/lower radar on multi-level maps and hides floors on Mirage", async () => {
    const withLower = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };
    vi.mocked(loadCalibrations).mockResolvedValue({
      de_mirage: UNIT_CALIBRATION,
      de_nuke: withLower,
      de_vertigo: withLower,
      de_train: withLower,
    });
    renderBoard();
    await userEvent.click(await screen.findByRole("button", { name: "Nuke" }));
    await createBookFromMap("Nuke");
    expect(screen.getByRole("button", { name: "Auto" })).toHaveClass("on");
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-floor", "auto");
    await userEvent.click(screen.getByRole("button", { name: "Lower" }));
    expect(screen.getByRole("button", { name: "Lower" })).toHaveClass("on");
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-floor", "lower");
    await userEvent.click(screen.getByRole("button", { name: "Upper" }));
    expect(screen.getByRole("button", { name: "Upper" })).toHaveClass("on");
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-floor", "upper");

    await userEvent.click(screen.getByRole("button", { name: "Vertigo" }));
    await createBookFromMap("Vertigo");
    expect(screen.getByRole("button", { name: "Lower" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Train" }));
    await createBookFromMap("Train");
    expect(screen.getByRole("button", { name: "Lower" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mirage" }));
    await createBookFromMap("Mirage");
    expect(screen.queryByRole("button", { name: "Lower" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upper" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auto" })).not.toBeInTheDocument();
  });

  it("shows only the current floor's drawings on multi-level maps", async () => {
    const withLower = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };
    vi.mocked(loadCalibrations).mockResolvedValue({
      de_mirage: UNIT_CALIBRATION,
      de_nuke: withLower,
    });
    const created = await createPlaybook("de_nuke", "Nuke execs");
    const page = created.pages[0]!;
    const upper = emptyNote();
    upper.pieces.push(makePiece("smoke", 1, 2));
    const lower = emptyNote();
    lower.pieces.push(makePiece("flash", 3, 4));
    lower.pieces.push(makePiece("he", 5, 6));
    await savePlaybook({
      ...created,
      pages: [{ ...page, note: upper, lowerNote: lower }],
    });
    renderBoard("/playbook?map=de_nuke&playbook=Nuke+execs");
    expect(await screen.findByTestId("playbook-canvas")).toHaveAttribute("data-pieces", "1");
    await userEvent.click(screen.getByRole("button", { name: "Lower" }));
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-floor", "lower");
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-pieces", "2");
    await userEvent.click(screen.getByRole("button", { name: "Upper" }));
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-floor", "upper");
    expect(screen.getByTestId("playbook-canvas")).toHaveAttribute("data-pieces", "1");
  });

  it("opens a book and strat from the share URL", async () => {
    await createPlaybook("de_mirage", "my_playbook");
    renderBoard("/playbook?map=de_mirage&playbook=my_playbook&strat=Untitled+strat");
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "my_playbook" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Untitled strat" })).toHaveClass("is-active");
  });

  it("opens a book from the home create handoff", async () => {
    const book = await createPlaybook("de_mirage", "A execs");
    rememberPlaybookFocus({ mapName: book.mapName, bookKey: book.key });
    renderBoard(
      playbookHref({
        map: book.mapName,
        playbook: book.title,
        strat: UNTITLED_STRAT,
      }),
    );
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A execs" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: UNTITLED_STRAT })).toHaveClass("is-active");
  });

  it("opens the remembered snapshot book expanded", async () => {
    const book = await createPlaybook("de_inferno", "A execs");
    rememberPlaybookFocus({ mapName: "de_inferno", bookKey: book.key });
    renderBoard();
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A execs" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Untitled strat" })).toHaveClass("is-active");
  });

  it("shows the create-playbook card when no book is open", async () => {
    renderBoard();
    const card = await screen.findByRole("button", {
      name: /Create a playbook/,
    });
    expect(card).toHaveClass("home-card", "home-playbook");
    expect(screen.getByText("Draw named strats on a radar. No demo required.")).toBeInTheDocument();
    expect(screen.getByText("Open playbook.")).toBeInTheDocument();
    expect(document.querySelector(".playbook-empty-art")).toBeNull();
  });

  it("opens the create dialog from the empty-board card", async () => {
    renderBoard();
    await userEvent.click(await screen.findByRole("button", { name: /Create a playbook/ }));
    expect(await screen.findByRole("heading", { name: "New playbook" })).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Map" })).toHaveValue("de_mirage");
    expect(screen.getByRole("textbox", { name: "Playbook title" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "New playbook" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create a playbook/ })).toBeInTheDocument();
  });

  it("deletes the open playbook", async () => {
    renderBoard();
    await createBookFromMap();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled playbook" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete playbook" }));
    await waitFor(() => expect(screen.queryByTestId("playbook-canvas")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Create a playbook/ })).toBeInTheDocument();
  });

  it("shows a load error when calibrations fail", async () => {
    vi.mocked(loadCalibrations).mockRejectedValue(new Error("maps down"));
    renderBoard();
    expect(await screen.findByText("maps down")).toBeInTheDocument();
  });

  it("ignores a late calibrations result after unmount", async () => {
    let resolve: (value: Record<string, typeof UNIT_CALIBRATION>) => void = () => undefined;
    vi.mocked(loadCalibrations).mockImplementation(
      () =>
        new Promise((next) => {
          resolve = next;
        }),
    );
    const { unmount } = renderBoard();
    unmount();
    resolve({ de_mirage: UNIT_CALIBRATION });
    await waitFor(() => expect(loadCalibrations).toHaveBeenCalled());
  });

  it("keeps the tutorial Playbook step on the sample book only", async () => {
    const real = await createPlaybook("de_mirage", "My real book");
    await createPlaybook("de_inferno", "Other map book");
    const { unmount } = renderBoard("/tutorial/playbook");
    expect(await screen.findByRole("button", { name: "Tutorial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dust II" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mirage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My real book" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Other map book" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inferno" })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Tutorial" }));
    expect(screen.queryByRole("menuitem", { name: "Duplicate playbook" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete playbook" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export PDF" })).toBeInTheDocument();
    expect(await loadPlaybook(real.key)).toMatchObject({
      title: "My real book",
    });
    unmount();
    renderBoard("/playbook");
    expect(await screen.findByRole("button", { name: "My real book" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inferno" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tutorial" })).not.toBeInTheDocument();
  });

  it("adds a tutorial strat without offering to open it elsewhere", async () => {
    renderBoard("/tutorial/playbook");
    expect(await screen.findByRole("button", { name: "Tutorial" })).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Tutorial" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New strat" }));
    expect(screen.getAllByRole("button", { name: "Untitled strat" }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.queryByRole("button", { name: "Open strat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("exports a PDF from the tutorial sandbox book", async () => {
    renderBoard("/tutorial/playbook");
    expect(await screen.findByRole("button", { name: "Tutorial" })).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Tutorial" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Export PDF" }));
    expect(screen.getByRole("dialog", { name: "Export PDF" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Without photos" }));
    await waitFor(() => expect(downloadPlaybookPdf).toHaveBeenCalledTimes(1));
    expect(downloadPlaybookPdf.mock.calls[0]?.[0]).toMatchObject({
      title: "Tutorial",
      mapName: "de_dust2",
    });
    expect(downloadPlaybookPdf.mock.calls[0]?.[1]).toBe(UNIT_CALIBRATION);
    expect(downloadPlaybookPdf.mock.calls[0]?.[5]).toBe(false);
    expect(screen.queryByRole("button", { name: "Open strat" })).not.toBeInTheDocument();
  });
});
