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
import { en } from "@/lib/i18n/translations/en";
import { pl } from "@/lib/i18n/translations/pl";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, loadUserSettings } from "@/lib/settings/userSettingsStore";
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
  await userEvent.click(screen.getByRole("button", { name: en.settings.aria }));
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
    expect(screen.getByRole("button", { name: en.header.homeAria })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.nav.analyzer })).toHaveAttribute(
      "href",
      "/analyzer",
    );
    expect(screen.getByRole("link", { name: en.nav.playbook })).toHaveAttribute(
      "href",
      "/playbook",
    );
    expect(screen.getByRole("link", { name: en.nav.faq })).toHaveAttribute("href", "/faq");
    expect(screen.getByText(en.header.preRelease)).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(/backward compatible/);
    expect(screen.queryByRole("button", { name: en.header.newDemo })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.header.exportCsv })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.settings.exportNotes })).not.toBeInTheDocument();

    await openSettings();
    expect(screen.getByRole("button", { name: en.settings.preferences })).toBeInTheDocument();
    expect(screen.getByText(en.settings.notes)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.settings.exportPlaybooks })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.settings.exportNotes })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.settings.importNotes })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.settings.removeNotes })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.settings.exportPlaybooks })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.settings.importPlaybooks })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.settings.removePlaybooks })).toBeDisabled();
  });

  async function openPreferences() {
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: en.settings.preferences }));
    const dialog = await screen.findByRole("dialog", { name: en.settings.preferences });
    const backdrop = dialog.closest(".settings-modal");
    expect(backdrop?.parentElement).toBe(document.body);
    expect(screen.getByRole("button", { name: "Reset all settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.settings.exportNotes })).not.toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(screen.getByRole("dialog", { name: en.settings.preferences })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: en.settings.exportNotes })).toBeEnabled();
    expect(screen.getByRole("button", { name: en.settings.removeNotes })).toBeEnabled();
  });

  it("shows map, file meta, and viewer actions with a loaded replay", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    expect(screen.getByText(/Mirage · match\.dem · 1 kills/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.header.newDemo })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.header.exportCsv })).toBeInTheDocument();
    await openSettings();
    expect(screen.getByRole("button", { name: en.settings.exportNotes })).toBeEnabled();
    expect(screen.getByRole("button", { name: en.settings.importNotes })).toBeInTheDocument();
  });

  it("returns home from the brand and New demo", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: en.header.homeAria }));
    expect(state.close).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: en.header.newDemo }));
    expect(state.close).toHaveBeenCalledTimes(2);
  });

  it("disables CSV export in aggregated view", () => {
    const state = viewerState(true);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    expect(screen.getByRole("button", { name: en.header.exportCsv })).toBeDisabled();
  });

  it("downloads per-demo stats as CSV", async () => {
    const state = viewerState(false);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: en.header.exportCsv }));
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
    await userEvent.click(screen.getByRole("button", { name: en.settings.exportNotes }));
    expect(state.exportNotes).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: en.settings.exportNotes })).not.toBeInTheDocument();
  });

  it("opens the remove-notes modal from settings and requires confirmation", async () => {
    const state = splashState(1);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: en.settings.removeNotes }));

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
    expect(screen.queryByRole("button", { name: en.header.newDemo })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.header.exportCsv })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Playbook" })).toHaveAttribute("aria-current", "page");
  });

  it("hides viewer actions on the FAQ page even with a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    renderHeader("/faq");
    expect(screen.queryByRole("button", { name: en.header.newDemo })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.header.exportCsv })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage · match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
  });

  it("closes settings on Escape", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openSettings();
    expect(screen.getByRole("button", { name: en.settings.exportNotes })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: en.settings.exportNotes })).not.toBeInTheDocument();
  });

  it("offers the layouts editor in development settings", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader();
    await openSettings();
    if (import.meta.env.DEV) {
      expect(screen.getByRole("button", { name: en.settings.layoutsEditor })).toBeInTheDocument();
    } else {
      expect(
        screen.queryByRole("button", { name: en.settings.layoutsEditor }),
      ).not.toBeInTheDocument();
    }
  });

  it("shows Callout Layout Editor title and a [dev] badge on /layouts", async () => {
    if (!import.meta.env.DEV) return;
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    renderHeader("/layouts");
    expect(screen.getByText("Callout Layout Editor")).toBeInTheDocument();
    expect(screen.getByText(en.header.preRelease)).toBeInTheDocument();
    expect(screen.getByText("[dev]")).toBeInTheDocument();
    await openSettings();
    expect(
      screen.queryByRole("button", { name: en.settings.layoutsEditor }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to analyzer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.nav.analyzer })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.faq })).not.toHaveAttribute("aria-current");
  });

  it("applies Polish chrome from Preferences without a reload", async () => {
    await clearUserSettingsForTests();
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    render(
      <UserSettingsProvider>
        <TestRouter>
          <Header />
        </TestRouter>
      </UserSettingsProvider>,
    );
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: en.settings.preferences }));
    await userEvent.selectOptions(screen.getByLabelText(en.preferences.language), "pl");
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: pl.preferences.title })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: pl.nav.faq })).toBeInTheDocument();
      expect(document.documentElement.lang).toBe("pl");
    });
    expect(await loadUserSettings()).toMatchObject({ locale: "pl" });
  });

  it("exports, imports, and removes playbooks from settings", async () => {
    vi.mocked(useApp).mockReturnValue(splashState(0) as unknown as ReturnType<typeof useApp>);
    await createPlaybook("de_mirage", "Defaults");
    renderHeader();
    await openSettings();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: en.settings.exportPlaybooks })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: en.settings.exportPlaybooks }));
    expect(await screen.findByText("Exported 1 playbook.")).toBeInTheDocument();
    expect(downloadBlob).toHaveBeenCalled();

    const incoming = newPlaybook("de_inferno", "Imported");
    const input = document.querySelector(
      `input[aria-label="${en.settings.importPlaybooksFile}"]`,
    ) as HTMLInputElement;
    const file = new File([serializePlaybookBundle([incoming])], "books.json", {
      type: "application/json",
    });
    await userEvent.upload(input, file);
    expect(await screen.findByText("Imported 1 playbook.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: en.settings.removePlaybooks }));
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
    expect(await screen.findByRole("button", { name: en.settings.exportPlaybooks })).toBeDisabled();
  });
});
