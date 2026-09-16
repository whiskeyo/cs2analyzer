/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RADAR_GRAY,
  PATH_BRANCH_MERGE_DISTANCE,
  PATH_BRANCH_MIN_SHARE,
  PATH_BRANCH_PERCENT_SCALE,
  PATH_BRANCH_STEP_DISTANCE,
  PATH_BRANCH_STEP_GAP,
  SERIES_MAX_FILES,
  SERIES_MAX_FILES_HARD,
  seriesRamWarning,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/shared/constants";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import {
  clearUserSettingsForTests,
  loadUserSettings,
  saveUserSettings,
} from "@/lib/settings/userSettingsStore";
import * as userSettingsStore from "@/lib/settings/userSettingsStore";
import { UserSettingsModal } from "./UserSettingsModal";
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";
import { defaultUserSettings, parseUserSettings } from "@/lib/settings/userSettings";

function renderModal(onClose = () => undefined) {
  return render(
    <UserSettingsProvider>
      <UserSettingsModal onClose={onClose} />
    </UserSettingsProvider>,
  );
}

describe("UserSettingsModal", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearUserSettingsForTests();
  });

  it("edits settings and persists them", async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Preferences" })).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("dialog", { name: "Preferences" }).closest(".settings-modal")?.parentElement,
    ).toBe(document.body);
    await waitFor(() => expect(screen.getByLabelText("Saved notes page size")).toHaveValue(5));

    const pageSize = screen.getByLabelText("Saved notes page size");
    fireEvent.change(pageSize, { target: { value: "8" } });
    await waitFor(() => expect(pageSize).toHaveValue(8));

    fireEvent.change(screen.getByLabelText("Sidebar width"), {
      target: { value: String(SIDEBAR_MIN_WIDTH) },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Sidebar width")).toHaveValue(String(SIDEBAR_MIN_WIDTH)),
    );

    const stored = await loadUserSettings();
    expect(stored.savedNotesPageSize).toBe(8);
    expect(stored.sidebarWidth).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("resets to shipped defaults and does not require a typed phrase", async () => {
    await saveUserSettings({
      sidebarWidth: SIDEBAR_MIN_WIDTH,
      eventLeadInSec: 4,
      radarGray: 0,
    });
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Event lead-in")).toHaveValue(4));

    await userEvent.click(screen.getByRole("button", { name: "Reset all settings" }));
    expect(screen.getByRole("dialog", { name: "Reset all settings?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reset all" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Event lead-in")).toHaveValue(1.5);
      expect(screen.getByLabelText("Sidebar width")).toHaveValue(String(SIDEBAR_DEFAULT_WIDTH));
      expect(screen.getByLabelText("Radar map color")).toHaveValue("100");
    });
    const stored = await loadUserSettings();
    expect(stored.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(stored.eventLeadInSec).toBe(1.5);
    expect(stored.radarGray).toBe(DEFAULT_RADAR_GRAY);
  });

  it("round-trips Overall path knobs, clamps step below merge, and reset restores defaults", async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByLabelText("Overall merge")).toHaveValue(PATH_BRANCH_MERGE_DISTANCE),
    );
    expect(screen.getByLabelText("Overall step")).toHaveValue(PATH_BRANCH_STEP_DISTANCE);
    expect(screen.getByLabelText("Overall min share")).toHaveValue(
      String(PATH_BRANCH_MIN_SHARE * PATH_BRANCH_PERCENT_SCALE),
    );

    fireEvent.change(screen.getByLabelText("Overall merge"), { target: { value: "128" } });
    fireEvent.change(screen.getByLabelText("Overall step"), { target: { value: "400" } });
    fireEvent.change(screen.getByLabelText("Overall min share"), { target: { value: "10" } });

    await waitFor(() => {
      expect(screen.getByLabelText("Overall merge")).toHaveValue(128);
      expect(screen.getByLabelText("Overall step")).toHaveValue(128 - PATH_BRANCH_STEP_GAP);
      expect(screen.getByLabelText("Overall min share")).toHaveValue("10");
    });
    const stored = await loadUserSettings();
    expect(stored.pathBranchMergeDistance).toBe(128);
    expect(stored.pathBranchStepDistance).toBe(128 - PATH_BRANCH_STEP_GAP);
    expect(stored.pathBranchMinShare).toBe(0.1);

    await userEvent.click(screen.getByRole("button", { name: "Reset all settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset all" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Overall merge")).toHaveValue(PATH_BRANCH_MERGE_DISTANCE);
      expect(screen.getByLabelText("Overall step")).toHaveValue(PATH_BRANCH_STEP_DISTANCE);
      expect(screen.getByLabelText("Overall min share")).toHaveValue(
        String(PATH_BRANCH_MIN_SHARE * PATH_BRANCH_PERCENT_SCALE),
      );
    });
    const reset = await loadUserSettings();
    expect(reset.pathBranchMergeDistance).toBe(PATH_BRANCH_MERGE_DISTANCE);
    expect(reset.pathBranchStepDistance).toBe(PATH_BRANCH_STEP_DISTANCE);
    expect(reset.pathBranchMinShare).toBe(PATH_BRANCH_MIN_SHARE);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Preferences" })).toBeInTheDocument(),
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps default nade summary chips in the form, not as a HUD overlay", async () => {
    renderModal();
    const dialog = await screen.findByRole("dialog", { name: "Preferences" });
    const chips = screen.getByRole("toolbar", { name: "Default nade summary" });
    expect(chips).toHaveClass("nade-legend-embedded");
    expect(dialog).toContainElement(chips);
    expect(chips.parentElement).toHaveClass("settings-summary");
    expect(within(dialog).getByText("Default nade summary")).toBeInTheDocument();
    expect(within(chips).getByRole("button", { name: "Smoke" })).toBeInTheDocument();

    await userEvent.click(within(chips).getByRole("button", { name: /^T$/ }));
    await userEvent.click(within(chips).getByRole("button", { name: "HE" }));
    await userEvent.click(within(chips).getByRole("button", { name: "Decoy" }));
    await waitFor(async () => {
      const stored = await loadUserSettings();
      expect(stored.defaultSummaryFilter.t).toBe(false);
      expect(stored.defaultSummaryFilter.kinds.he).toBe(false);
      expect(stored.defaultSummaryFilter.kinds.decoy).toBe(false);
      expect(stored.defaultSummaryFilter.kinds.smoke).toBe(true);
    });
  });

  it("round-trips drawing, radar, playback, and series defaults after remount", async () => {
    const { unmount } = renderModal();
    await waitFor(() => expect(screen.getByLabelText("Saved notes page size")).toHaveValue(5));

    await userEvent.click(screen.getByRole("button", { name: "Heat" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Heat" })).toHaveClass("on"));
    await userEvent.click(screen.getByRole("button", { name: "#ff7a00" }));
    await userEvent.click(screen.getByRole("button", { name: "Pen" }));
    await userEvent.click(screen.getByRole("button", { name: "Lower" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Names" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Heat" }));
    await userEvent.selectOptions(screen.getByLabelText("Default sidebar tab"), "notes");
    await userEvent.selectOptions(screen.getByLabelText("Default speed"), "2");
    fireEvent.change(screen.getByLabelText("Max demos per drop"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Event lead-in"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Moment length"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Habits trail"), {
      target: { value: "30" },
    });
    await userEvent.click(screen.getByLabelText("Skip knife round when a demo loads"));

    await waitFor(async () => {
      const stored = await loadUserSettings();
      expect(stored.defaultPaletteId).toBe("heat");
      expect(stored.defaultColor).toBe("#ff7a00");
      expect(stored.defaultDrawTool).toBe("pen");
      expect(stored.defaultSidebarTab).toBe("notes");
      expect(stored.defaultFloorMode).toBe("lower");
      expect(stored.defaultLayers.names).toBe(false);
      expect(stored.defaultLayers.heatmap).toBe(true);
      expect(stored.defaultPlaybackSpeed).toBe(2);
      expect(stored.seriesMaxFiles).toBe(3);
      expect(stored.eventLeadInSec).toBe(3);
      expect(stored.noteMomentSec).toBe(8);
      expect(stored.habitsTrailWindowSec).toBe(30);
      expect(stored.skipKnifeOnOpen).toBe(false);
    });

    unmount();
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Default sidebar tab")).toHaveValue("notes"));
    expect(screen.getByLabelText("Default speed")).toHaveValue("2");
    expect(screen.getByRole("button", { name: "Heat" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "#ff7a00" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Pen" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Lower" })).toHaveClass("on");
    expect(screen.getByRole("checkbox", { name: "Names" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Heat" })).toBeChecked();
    expect(screen.getByLabelText("Max demos per drop")).toHaveValue("3");
    expect(screen.getByLabelText("Event lead-in")).toHaveValue(3);
    expect(screen.getByLabelText("Moment length")).toHaveValue(8);
    expect(screen.getByLabelText("Habits trail")).toHaveValue("30");
    expect(screen.getByLabelText("Skip knife round when a demo loads")).not.toBeChecked();
    expect(screen.getByLabelText("Saved notes page size")).toHaveValue(5);
    expect(screen.getByRole("button", { name: "Dark PDF" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dark PDF" })).toHaveClass("on");
    expect(screen.getByLabelText("Radar map color")).toHaveValue("100");
  });

  it("moves the map color slider and persists radarGray", async () => {
    renderModal();
    const slider = await screen.findByLabelText("Radar map color");
    expect(screen.queryByRole("checkbox", { name: /pawn colour legend/i })).toBeNull();
    expect(slider).toHaveValue("100");
    expect(slider).toHaveAttribute("aria-valuetext", "Gray");
    fireEvent.change(slider, { target: { value: "0" } });
    await waitFor(async () => {
      expect((await loadUserSettings()).radarGray).toBe(0);
    });
    expect(slider).toHaveValue("0");
    expect(slider).toHaveAttribute("aria-valuetext", "Color");
  });

  it("persists a light playbook PDF theme", async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Dark PDF" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Dark PDF" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Auto" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Neon" })).toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Light PDF" }));
    await waitFor(async () => {
      expect((await loadUserSettings()).pdfTheme).toBe("light");
    });
    expect(screen.getByRole("button", { name: "Light PDF" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Light PDF" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Dark PDF" })).not.toHaveClass("on");
  });

  it("persists a Playbook PDF without-photos choice", async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "With photos" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "With photos" })).toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Without photos" }));
    await waitFor(async () => {
      expect((await loadUserSettings()).pdfPhotos).toBe("without");
    });
    expect(screen.getByRole("button", { name: "Without photos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "With photos" })).not.toHaveClass("on");
  });

  it("raises the series drop cap to the hard ceiling and warns about RAM", async () => {
    renderModal();
    const slider = await screen.findByLabelText("Max demos per drop");
    expect(slider).toHaveAttribute("max", String(SERIES_MAX_FILES_HARD));
    expect(slider).toHaveValue(String(SERIES_MAX_FILES));
    expect(screen.queryByText(seriesRamWarning())).not.toBeInTheDocument();

    fireEvent.change(slider, {
      target: { value: String(SERIES_MAX_FILES_HARD) },
    });
    await waitFor(() => expect(slider).toHaveValue(String(SERIES_MAX_FILES_HARD)));
    expect(screen.getByText(seriesRamWarning())).toBeInTheDocument();

    const stored = await loadUserSettings();
    expect(stored.seriesMaxFiles).toBe(SERIES_MAX_FILES_HARD);
  });

  it("ignores a leftover click on the backdrop and closes on a new pointerdown", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    const dialog = await screen.findByRole("dialog", { name: "Preferences" });
    const backdrop = dialog.closest(".settings-modal");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows quota copy when a Preferences write cannot persist", async () => {
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Saved notes page size")).toHaveValue(5));
    vi.spyOn(userSettingsStore, "saveUserSettings").mockRejectedValue(quota);
    vi.spyOn(userSettingsStore, "loadUserSettings").mockResolvedValue(
      parseUserSettings({ ...defaultUserSettings(), savedNotesPageSize: 8 }),
    );
    fireEvent.change(screen.getByLabelText("Saved notes page size"), {
      target: { value: "8" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(IDB_QUOTA_MESSAGE);
    expect(screen.getByLabelText("Saved notes page size")).toHaveValue(8);
  });

  it("includes local database usage in Preferences", async () => {
    renderModal();
    expect(await screen.findByRole("heading", { name: "Local database" })).toBeInTheDocument();
    expect(await screen.findByText(/Local database usage:/)).toBeInTheDocument();
    expect(screen.getByText(/pages cannot raise it/)).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /storage/i })).not.toBeInTheDocument();
  });
});
