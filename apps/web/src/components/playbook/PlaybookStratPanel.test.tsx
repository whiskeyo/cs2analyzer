/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
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
});
