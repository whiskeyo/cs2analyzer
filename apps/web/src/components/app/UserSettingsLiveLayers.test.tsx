/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYERS } from "@/lib/notes/types";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests } from "@/lib/settings/userSettingsStore";
import type { AnalyzerState } from "@/lib/state/analyzerState";
import { useOptionalAnalyzer } from "@/lib/state/analyzerState";
import { UserSettingsModal } from "./UserSettingsModal";

vi.mock("@/lib/state/analyzerState", () => ({
  useOptionalAnalyzer: vi.fn(() => null),
}));

function renderModal() {
  return render(
    <UserSettingsProvider>
      <UserSettingsModal onClose={() => undefined} />
    </UserSettingsProvider>,
  );
}

describe("live radar overlays", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
    vi.mocked(useOptionalAnalyzer).mockReset();
    vi.mocked(useOptionalAnalyzer).mockReturnValue(null);
  });

  it("stays hidden until a demo is open", async () => {
    renderModal();
    await screen.findByRole("dialog", { name: "Preferences" });
    expect(screen.queryByRole("group", { name: "Radar overlays" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Default layers" })).toBeInTheDocument();
  });

  it("toggles the open demo layers and pauses when summary turns on", async () => {
    const setLayers = vi.fn();
    const setPlaying = vi.fn();
    vi.mocked(useOptionalAnalyzer).mockReturnValue({
      view: { layers: { ...DEFAULT_LAYERS }, setLayers },
      playback: { setPlaying },
    } as unknown as AnalyzerState);
    renderModal();
    const group = await screen.findByRole("group", { name: "Radar overlays" });
    expect(within(group).getByRole("checkbox", { name: "Nades" })).toBeChecked();
    expect(within(group).getByRole("checkbox", { name: "Summary" })).not.toBeChecked();
    expect(
      screen.getByText("This demo only. Defaults for the next demo stay under Default layers."),
    ).toBeInTheDocument();
    await userEvent.click(within(group).getByRole("checkbox", { name: "Shots" }));
    expect(setLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, shots: false });
    expect(setPlaying).not.toHaveBeenCalled();
    await userEvent.click(within(group).getByRole("checkbox", { name: "Summary" }));
    expect(setPlaying).toHaveBeenCalledWith(false);
    expect(setLayers).toHaveBeenCalledWith({ ...DEFAULT_LAYERS, summary: true });
    expect(screen.getByRole("group", { name: "Default layers" })).toBeInTheDocument();
  });
});
