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

  it("persists radar clip resolution and frame rate", async () => {
    renderModal();
    const size = await screen.findByLabelText("Clip resolution");
    const fps = screen.getByLabelText("Clip frame rate");
    expect(size).toHaveValue("1080");
    expect(fps).toHaveValue("30");
    fireEvent.change(size, { target: { value: "1440" } });
    fireEvent.change(fps, { target: { value: "60" } });
    await waitFor(async () => {
      const stored = await loadUserSettings();
      expect(stored.clipExportSize).toBe(1440);
      expect(stored.clipExportFps).toBe(60);
    });
  });
});
