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
    images: [],
    openVideoId: null,
    pendingPin: null,
    onCancelPin: vi.fn(),
    selectedId: null,
    openImageId: null,
    onBody: vi.fn(),
    onVideos: vi.fn(),
    onImages: vi.fn(),
    onOpenImage: vi.fn(),
    imageError: null,
    onImageError: vi.fn(),
    onOpenVideo: vi.fn(),
    onSelect: vi.fn(),
    onNote: vi.fn(),
    note: emptyNote(),
    ...overrides,
  };
}

describe("PlaybookStratPanel", () => {
  it("shows a plain notes field and does not offer Export PDF", () => {
    render(<PlaybookStratPanel {...panelProps()} />);
    expect(screen.getByRole("heading", { name: "Strat" })).toBeInTheDocument();
    expect(screen.getByText("A exec")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Strat notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Italic" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Underline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Strat notes style" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
  });

  it("keeps leftover markers as characters and edits the stored string", async () => {
    const onBody = vi.fn();
    render(<PlaybookStratPanel {...panelProps({ body: "Smoke **stairs**", onBody })} />);
    const notes = screen.getByRole("textbox", { name: "Strat notes" });
    expect(notes).toHaveValue("Smoke **stairs**");
    await userEvent.type(notes, "!");
    expect(onBody).toHaveBeenLastCalledWith("Smoke **stairs**!");
  });
});
