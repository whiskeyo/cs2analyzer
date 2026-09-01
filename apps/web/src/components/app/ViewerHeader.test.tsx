import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeKill, makeReplay } from "@/lib/testing/fixtures";
import { ViewerHeader } from "./ViewerHeader";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("@/lib/shared/download", () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from "@/lib/shared/download";

function viewerState(aggregated = false) {
  const replay = makeReplay({
    header: { map_name: "de_mirage" },
    kills: [makeKill(100, 0, 1)],
    grenades: [],
  });
  const demo = loadedDemo(replay, "match.dem", new File([], "match.dem"));
  const close = vi.fn();
  const exportNotes = vi.fn().mockResolvedValue(undefined);
  const onFiles = vi.fn();
  return {
    session: {
      replay,
      fileName: "match.dem",
      close,
      series: buildSeries("de_mirage", [demo, loadedDemo(replay, "b.dem", new File([], "b.dem"))]),
    },
    playback: { tick: 200 },
    review: { exportNotes },
    habits: { aggregated },
    onFiles,
    close,
    exportNotes,
  };
}

describe("ViewerHeader", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders nothing without a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue({
      session: { replay: null },
    } as unknown as ReturnType<typeof useApp>);
    const { container } = render(<ViewerHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows map, file meta, and export actions", () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<ViewerHeader />);
    expect(screen.getByRole("heading", { name: "CS2 Analyzer" })).toBeInTheDocument();
    expect(screen.getByText(/Mirage · match\.dem · 1 kills/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import notes" })).toBeInTheDocument();
  });

  it("returns to splash on New demo", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<ViewerHeader />);
    await userEvent.click(screen.getByRole("button", { name: "New demo" }));
    expect(state.close).toHaveBeenCalled();
  });

  it("disables CSV export in aggregated view", () => {
    const state = viewerState(true);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<ViewerHeader />);
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("downloads per-demo stats as CSV", async () => {
    const state = viewerState(false);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<ViewerHeader />);
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(downloadBlob).toHaveBeenCalledWith(
      "match-stats.csv",
      "text/csv",
      expect.stringContaining("Player"),
    );
  });
});
