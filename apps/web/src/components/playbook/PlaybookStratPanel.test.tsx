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
  it("shows strat notes and does not offer Export PDF", () => {
    render(<PlaybookStratPanel {...panelProps()} />);
    expect(screen.getByRole("heading", { name: "Strat" })).toBeInTheDocument();
    expect(screen.getByText("A exec")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Strat notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
  });

  it("wraps a selection in markdown and previews emphasis", async () => {
    const onBody = vi.fn();
    const first = render(<PlaybookStratPanel {...panelProps({ body: "flash mid", onBody })} />);
    const notes = screen.getByRole("textbox", { name: "Strat notes" });
    notes.focus();
    (notes as HTMLTextAreaElement).setSelectionRange(0, 5);
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onBody).toHaveBeenCalledWith("**flash** mid");
    first.unmount();
    render(<PlaybookStratPanel {...panelProps({ body: "**flash** *mid* __hold__" })} />);
    const preview = screen.getByLabelText("Strat notes preview");
    expect(preview.querySelector("strong")).toHaveTextContent("flash");
    expect(preview.querySelector("em")).toHaveTextContent("mid");
    expect(preview.querySelector("u")).toHaveTextContent("hold");
  });
});
