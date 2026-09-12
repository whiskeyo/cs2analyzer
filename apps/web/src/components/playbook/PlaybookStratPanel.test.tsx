/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { PlaybookStratPanel } from "./PlaybookStratPanel";

function panelProps(overrides: Partial<Parameters<typeof PlaybookStratPanel>[0]> = {}) {
  return {
    stratTitle: "A exec",
    body: "",
    videos: [],
    openVideoId: null,
    pendingPin: null,
    onCancelPin: vi.fn(),
    selectedId: null,
    onBody: vi.fn(),
    onVideos: vi.fn(),
    onOpenVideo: vi.fn(),
    onSelect: vi.fn(),
    onNote: vi.fn(),
    note: emptyNote(),
    ...overrides,
  };
}

describe("PlaybookStratPanel", () => {
  it("shows a single notes editor and does not offer Export PDF", () => {
    render(<PlaybookStratPanel {...panelProps()} />);
    expect(screen.getByRole("heading", { name: "Strat" })).toBeInTheDocument();
    expect(screen.getByText("A exec")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Strat notes" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Strat notes preview")).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*bold\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
  });

  it("renders stored markdown as live emphasis in the editor", () => {
    render(<PlaybookStratPanel {...panelProps({ body: "**flash** *mid* __hold__" })} />);
    const notes = screen.getByRole("textbox", { name: "Strat notes" });
    expect(notes.querySelector("strong")).toHaveTextContent("flash");
    expect(notes.querySelector("em")).toHaveTextContent("mid");
    expect(notes.querySelector("u")).toHaveTextContent("hold");
    expect(notes).not.toHaveTextContent("**");
    expect(notes).not.toHaveTextContent("__");
  });

  it("wraps a selection from the toolbar and persists markdown", async () => {
    const onBody = vi.fn();
    render(<PlaybookStratPanel {...panelProps({ body: "flash mid", onBody })} />);
    const notes = screen.getByRole("textbox", { name: "Strat notes" });
    const text = notes.firstChild;
    expect(text?.nodeType).toBe(Node.TEXT_NODE);
    const range = document.createRange();
    range.setStart(text as Text, 0);
    range.setEnd(text as Text, 5);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onBody).toHaveBeenCalledWith("**flash** mid");
    expect(notes.querySelector("strong")).toHaveTextContent("flash");
  });
});
