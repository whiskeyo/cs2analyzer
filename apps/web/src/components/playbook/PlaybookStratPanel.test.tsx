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
  it("hides Export PDF until a handler is passed", () => {
    render(<PlaybookStratPanel {...panelProps()} />);
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
  });

  it("downloads from the open book and shows a busy label", async () => {
    const onExportPdf = vi.fn();
    const first = render(<PlaybookStratPanel {...panelProps({ onExportPdf })} />);
    await userEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(onExportPdf).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<PlaybookStratPanel {...panelProps({ onExportPdf, exportBusy: true })} />);
    expect(screen.getByRole("button", { name: "Exporting…" })).toBeDisabled();
  });
});
