import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeKill, makeReplay } from "@/lib/testing/fixtures";
import { Header } from "./Header";

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
  const removeAllNotes = vi.fn().mockResolvedValue(undefined);
  const onFiles = vi.fn();
  return {
    session: {
      replay,
      fileName: "match.dem",
      close,
      series: buildSeries("de_mirage", [demo, loadedDemo(replay, "b.dem", new File([], "b.dem"))]),
    },
    playback: { tick: 200 },
    review: { exportNotes, removeAllNotes, saved: [] },
    habits: { aggregated },
    onFiles,
    close,
    exportNotes,
    removeAllNotes,
  };
}

function splashState(savedCount = 0) {
  const close = vi.fn();
  const exportNotes = vi.fn().mockResolvedValue(undefined);
  const removeAllNotes = vi.fn().mockResolvedValue(undefined);
  const onFiles = vi.fn();
  return {
    session: { replay: null, fileName: "", close },
    playback: { tick: 0 },
    review: {
      exportNotes,
      removeAllNotes,
      saved: Array.from({ length: savedCount }, (_, i) => ({ key: `k${i}` })),
    },
    habits: { aggregated: false },
    onFiles,
    close,
    exportNotes,
    removeAllNotes,
  };
}

async function openSettings() {
  await userEvent.click(screen.getByRole("button", { name: "Settings" }));
}

describe("Header", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    window.history.replaceState({}, "", "/");
  });

  it("shows brand and settings on the splash", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("href", "/analyzer");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByText("[pre-release testing]")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(/backward compatible/);
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();

    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove notes" })).toBeDisabled();
  });

  it("enables Export notes in settings when saved notes exist", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(1) as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove notes" })).toBeEnabled();
  });

  it("shows map, file meta, and viewer actions with a loaded replay", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    expect(screen.getByText(/Mirage · match\.dem · 1 kills/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Import notes" })).toBeInTheDocument();
  });

  it("returns home from the brand and New demo", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(state.close).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "New demo" }));
    expect(state.close).toHaveBeenCalledTimes(2);
  });

  it("disables CSV export in aggregated view", () => {
    const state = viewerState(true);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("downloads per-demo stats as CSV", async () => {
    const state = viewerState(false);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(downloadBlob).toHaveBeenCalledWith(
      "match-stats.csv",
      "text/csv",
      expect.stringContaining("Player"),
    );
  });

  it("exports notes from settings", async () => {
    const state = splashState(1);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Export notes" }));
    expect(state.exportNotes).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();
  });

  it("opens the remove-notes modal from settings and requires confirmation", async () => {
    const state = splashState(1);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Remove notes" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Remove all saved notes?");
    const removeBtn = screen.getByRole("button", { name: "Remove all notes" });
    expect(removeBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Confirmation phrase"), "yes, remove notes");
    expect(removeBtn).toBeEnabled();
    await userEvent.click(removeBtn);
    expect(state.removeAllNotes).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides viewer actions on the FAQ page even with a loaded replay", () => {
    window.history.replaceState({}, "", "/faq");
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
  });

  it("closes settings on Escape", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();
  });

  it("offers the layouts editor in development settings", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    await openSettings();
    if (import.meta.env.DEV) {
      expect(screen.getByRole("button", { name: "Layouts editor" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "Layouts editor" })).not.toBeInTheDocument();
    }
  });

  it("shows Callout Layout Editor title and a [dev] badge on /layouts", async () => {
    if (!import.meta.env.DEV) return;
    window.history.replaceState({}, "", "/layouts");
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    render(<Header />);
    expect(screen.getByText("Callout Layout Editor")).toBeInTheDocument();
    expect(screen.getByText("[pre-release testing]")).toBeInTheDocument();
    expect(screen.getByText("[dev]")).toBeInTheDocument();
    await openSettings();
    expect(screen.queryByRole("button", { name: "Layouts editor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to analyzer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
  });
});
