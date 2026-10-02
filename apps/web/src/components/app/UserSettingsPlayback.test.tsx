/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, loadUserSettings } from "@/lib/settings/userSettingsStore";
import { UserSettingsModal } from "./UserSettingsModal";

function renderModal() {
  return render(
    <UserSettingsProvider>
      <UserSettingsModal onClose={() => undefined} />
    </UserSettingsProvider>,
  );
}

describe("clip export preferences", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await clearUserSettingsForTests();
  });

  it("persists radar clip resolution", async () => {
    renderModal();
    const size = await screen.findByLabelText("Clip resolution");
    expect(size).toHaveValue("1080");
    expect(screen.queryByLabelText("Clip frame rate")).not.toBeInTheDocument();
    fireEvent.change(size, { target: { value: "1440" } });
    await waitFor(async () => {
      const stored = await loadUserSettings();
      expect(stored.clipExportSize).toBe(1440);
    });
  });
});
