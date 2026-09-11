/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH } from "@/lib/shared/constants";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import {
  clearUserSettingsForTests,
  loadUserSettings,
  saveUserSettings,
} from "@/lib/settings/userSettingsStore";
import { UserSettingsModal } from "./UserSettingsModal";

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
    });
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Event lead-in")).toHaveValue(4));

    await userEvent.click(screen.getByRole("button", { name: "Reset all settings" }));
    expect(screen.getByRole("dialog", { name: "Reset all settings?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reset all" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Event lead-in")).toHaveValue(1.5);
      expect(screen.getByLabelText("Sidebar width")).toHaveValue(String(SIDEBAR_DEFAULT_WIDTH));
    });
    const stored = await loadUserSettings();
    expect(stored.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(stored.eventLeadInSec).toBe(1.5);
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

    await userEvent.click(within(chips).getByRole("button", { name: "T" }));
    await waitFor(async () => {
      const stored = await loadUserSettings();
      expect(stored.defaultSummaryFilter.t).toBe(false);
    });
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
});
