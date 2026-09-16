import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeKill, makeReplay } from "@/lib/testing/fixtures";
import { createPlaybook, deleteAllPlaybooks } from "@/lib/playbook/playbookStore";
import { newPlaybook } from "@/lib/playbook/pages";
import { serializePlaybookBundle } from "@/lib/playbook/transfer";
import { TestRouter } from "@/lib/testing/router";
import { Header } from "./Header";

function renderHeader(path = "/") {
  return render(
    <TestRouter path={path}>
      <Header />
    </TestRouter>,
  );
}

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
  beforeEach(async () => {
    vi.mocked(useApp).mockReset();
    window.history.replaceState({}, "", "/");
    await deleteAllPlaybooks();
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
  });

  it("shows brand and settings on the splash", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("href", "/analyzer");
    expect(screen.getByRole("link", { name: "Playbook" })).toHaveAttribute("href", "/playbook");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Rating" })).toHaveAttribute("href", "/rating");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    expect(screen.getByText("[pre-release testing]")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(/backward compatible/);
    expect(screen.queryByRole("button", { name: "Add demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();

    await openSettings();
    expect(screen.getByRole("button", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export playbooks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove notes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export playbooks" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import playbooks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove all playbooks" })).toBeDisabled();
  });

  async function openPreferences() {
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Preferences" }));
    const dialog = await screen.findByRole("dialog", { name: "Preferences" });
    const backdrop = dialog.closest(".settings-modal");
    expect(backdrop?.parentElement).toBe(document.body);
    expect(screen.getByRole("button", { name: "Reset all settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(screen.getByRole("dialog", { name: "Preferences" })).toBeInTheDocument();
  }

  it("opens the preferences modal from the gear on splash and viewer", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    const first = renderHeader();
    await openPreferences();
    first.unmount();

    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openPreferences();
  });

  it("enables Export notes in settings when saved notes exist", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(1) as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove notes" })).toBeEnabled();
  });

  it("shows map, file meta, and viewer actions with a loaded replay", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    expect(screen.getByText(/Mirage · match\.dem · 1 kills/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Import notes" })).toBeInTheDocument();
  });

  it("returns home from the brand and New demo", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(state.close).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "New demo" }));
    expect(state.close).toHaveBeenCalledTimes(2);
  });

  it("disables CSV export in aggregated view", () => {
    const state = viewerState(true);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("downloads per-demo stats as CSV", async () => {
    const state = viewerState(false);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
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
    renderHeader();
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Export notes" }));
    expect(state.exportNotes).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();
  });

  it("opens the remove-notes modal from settings and requires confirmation", async () => {
    const state = splashState(1);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
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

  it("hides viewer actions on Playbook even with a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    renderHeader("/playbook");
    expect(screen.queryByRole("button", { name: "Add demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Playbook" })).toHaveAttribute("aria-current", "page");
  });

  it("hides viewer actions on the Rating page even with a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    renderHeader("/rating");
    expect(screen.queryByRole("button", { name: "Add demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rating" })).toHaveAttribute("aria-current", "page");
  });

  it("hides viewer actions on the FAQ page even with a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    renderHeader("/faq");
    expect(screen.queryByRole("button", { name: "Add demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
  });

  it("hides viewer actions on the Contact page even with a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    renderHeader("/contact");
    expect(screen.queryByRole("button", { name: "Add demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "page");
  });

  it("closes settings on Escape", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openSettings();
    expect(screen.getByRole("button", { name: "Export notes" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Export notes" })).not.toBeInTheDocument();
  });

  it("offers the layouts editor in development settings", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openSettings();
    if (import.meta.env.DEV) {
      expect(screen.getByRole("button", { name: "Layouts editor" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "Layouts editor" })).not.toBeInTheDocument();
    }
  });

  it("shows Callout Layout Editor title and a [dev] badge on /layouts", async () => {
    if (!import.meta.env.DEV) return;
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader("/layouts");
    expect(screen.getByText("Callout Layout Editor")).toBeInTheDocument();
    expect(screen.getByText("[pre-release testing]")).toBeInTheDocument();
    expect(screen.getByText("[dev]")).toBeInTheDocument();
    await openSettings();
    expect(screen.queryByRole("button", { name: "Layouts editor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to analyzer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
  });

  it("exports, imports, and removes playbooks from settings", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    await createPlaybook("de_mirage", "Defaults");
    renderHeader();
    await openSettings();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export playbooks" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Export playbooks" }));
    expect(await screen.findByText("Exported 1 playbook.")).toBeInTheDocument();
    expect(downloadBlob).toHaveBeenCalled();

    const incoming = newPlaybook("de_inferno", "Imported");
    const input = document.querySelector(
      'input[aria-label="Import playbooks file"]',
    ) as HTMLInputElement;
    const file = new File([serializePlaybookBundle([incoming])], "books.json", {
      type: "application/json",
    });
    await userEvent.upload(input, file);
    expect(await screen.findByText("Imported 1 playbook.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove all playbooks" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Remove all playbooks?");
    const removeBtn = screen.getByRole("button", {
      name: "Remove all playbooks",
    });
    expect(removeBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Confirmation phrase"), "yes, remove playbooks");
    expect(removeBtn).toBeEnabled();
    await userEvent.click(removeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await openSettings();
    expect(await screen.findByRole("button", { name: "Export playbooks" })).toBeDisabled();
  });
});
