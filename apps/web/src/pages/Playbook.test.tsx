/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { COPY_SUFFIX } from "@/lib/playbook/types";
import { PLAYBOOK_FOCUS_KEY, rememberPlaybookFocus } from "@/lib/playbook/focus";
import { createPlaybook, deleteAllPlaybooks } from "@/lib/playbook/playbookStore";
import { Playbook } from "./Playbook";

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(),
  };
});

vi.mock("@/components/playbook/PlaybookCanvas", () => ({
  PlaybookCanvas: () => <div data-testid="playbook-canvas" />,
}));

import { loadCalibrations } from "@/lib/radar/maps";

describe("Playbook", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    vi.mocked(loadCalibrations).mockReset();
    vi.mocked(loadCalibrations).mockResolvedValue({
      de_inferno: UNIT_CALIBRATION,
      de_mirage: UNIT_CALIBRATION,
    });
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
  });

  it("picks a map, creates a book, and opens the board", async () => {
    render(<Playbook />);
    expect(await screen.findByRole("button", { name: "Mirage" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Inferno" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New playbook title" }), "A execs");
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize playbook tree" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize strat panel" })).toBeInTheDocument();
    const root = document.querySelector(".playbook");
    expect(root?.firstElementChild).toHaveClass("playbook-stage");
    expect(root?.querySelector(".playbook-detail")).toBeTruthy();
    expect(root?.lastElementChild).toHaveClass("playbook-tree-pane");
    fireEvent.keyDown(screen.getByRole("button", { name: "A execs" }), { key: "F2" });
    expect(screen.getByRole("textbox", { name: "Book title" })).toHaveValue("A execs");
    fireEvent.change(screen.getByRole("textbox", { name: "Book title" }), {
      target: { value: "Anti strats" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Book title" }));
    expect(screen.getByRole("button", { name: "Anti strats" })).toHaveClass("is-active");
  });

  it("adds, switches, duplicates, and deletes strats including the last one", async () => {
    render(<Playbook />);
    await screen.findByRole("button", { name: "Mirage" });
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete strat" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "New strat" }));
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
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Strat name" }), { key: "Escape" });

    await userEvent.click(screen.getByRole("button", { name: "A exec" }));
    await userEvent.click(screen.getByRole("button", { name: "Duplicate strat" }));
    expect(screen.getByRole("button", { name: `A exec${COPY_SUFFIX}` })).toHaveClass("is-active");

    await userEvent.click(screen.getByRole("button", { name: "Delete strat" }));
    expect(screen.queryByRole("button", { name: `A exec${COPY_SUFFIX}` })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "A exec" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete strat" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete strat" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Untitled strat" }));
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue("Untitled strat");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Strat name" }), { key: "Escape" });
    expect(screen.getByTestId("playbook-canvas")).toBeInTheDocument();
  });

  it("lets a title stay empty until blur and keeps spaces while typing", async () => {
    render(<Playbook />);
    await screen.findByRole("button", { name: "Mirage" });
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Untitled playbook" }), { key: "F2" });
    const title = screen.getByRole("textbox", { name: "Book title" });
    fireEvent.change(title, { target: { value: "" } });
    expect(title).toHaveValue("");
    fireEvent.change(title, { target: { value: "Mid hold" } });
    expect(title).toHaveValue("Mid hold");
    fireEvent.blur(title);
    expect(screen.getByRole("button", { name: "Mid hold" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Mid hold" }), { key: "F2" });
    fireEvent.change(screen.getByRole("textbox", { name: "Book title" }), {
      target: { value: "   " },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Book title" }));
    expect(screen.getByRole("button", { name: "Untitled playbook" })).toBeInTheDocument();
  });

  it("keeps playbook order when switching the active book", async () => {
    await createPlaybook("de_mirage", "First");
    await createPlaybook("de_mirage", "Second");
    render(<Playbook />);
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
    await userEvent.click(screen.getByRole("button", { name: "Move First down" }));
    await waitFor(() => {
      const movedFirst = screen.getByRole("button", { name: "First" });
      const movedSecond = screen.getByRole("button", { name: "Second" });
      expect(
        movedSecond.compareDocumentPosition(movedFirst) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("shows token tools, nade modes, and strat notes instead of a text box", async () => {
    render(<Playbook />);
    await screen.findByRole("button", { name: "Mirage" });
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    expect(await screen.findByRole("toolbar", { name: "Playbook tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nade trail" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nade effect" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing on the radar yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Strat notes" }), {
      target: { value: "smoke CT, flash palace" },
    });
    expect(screen.getByRole("textbox", { name: "Strat notes" })).toHaveValue(
      "smoke CT, flash palace",
    );
    await userEvent.click(screen.getByRole("button", { name: "Flash" }));
    expect(screen.getByRole("button", { name: "Flash" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the remembered snapshot book expanded", async () => {
    const book = await createPlaybook("de_inferno", "A execs");
    rememberPlaybookFocus({ mapName: "de_inferno", bookKey: book.key });
    render(<Playbook />);
    expect(await screen.findByTestId("playbook-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A execs" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Untitled strat" })).toHaveClass("is-active");
  });

  it("shows empty-board art when no book is open", async () => {
    render(<Playbook />);
    expect(await screen.findByText("Open a playbook to draw on the radar.")).toBeInTheDocument();
    expect(document.querySelector(".playbook-empty-art")).toBeTruthy();
  });

  it("deletes the open playbook", async () => {
    render(<Playbook />);
    await screen.findByRole("button", { name: "Mirage" });
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    await screen.findByTestId("playbook-canvas");
    await userEvent.click(screen.getByRole("button", { name: "Delete playbook" }));
    await waitFor(() => expect(screen.queryByTestId("playbook-canvas")).not.toBeInTheDocument());
    expect(screen.getByText("Open a playbook to draw on the radar.")).toBeInTheDocument();
  });

  it("shows a load error when calibrations fail", async () => {
    vi.mocked(loadCalibrations).mockRejectedValue(new Error("maps down"));
    render(<Playbook />);
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
    const { unmount } = render(<Playbook />);
    unmount();
    resolve({ de_mirage: UNIT_CALIBRATION });
    await waitFor(() => expect(loadCalibrations).toHaveBeenCalled());
  });
});
