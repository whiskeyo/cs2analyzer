import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { TUTORIAL_ID } from "@/lib/tutorial/identity";
import { TestRouter } from "@/lib/testing/router";
import { TutorialBanner } from "./TutorialBanner";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

const updateSettings = vi.fn();

vi.mock("@/lib/settings/useUserSettings", () => ({
  useUserSettings: () => ({
    settings: { tutorialCompleted: false },
    ready: true,
    saveError: null,
    update: updateSettings,
    reset: vi.fn(),
  }),
}));

function bannerState(id: string | null) {
  return {
    session: {
      demo: id ? { id } : null,
      close: vi.fn(),
    },
  };
}

describe("TutorialBanner", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    updateSettings.mockReset();
  });

  it("hides when the open demo is not a tutorial fixture", () => {
    vi.mocked(useApp).mockReturnValue(
      bannerState("de_mirage|match.dem") as unknown as ReturnType<typeof useApp>,
    );
    render(
      <TestRouter path="/analyzer">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();
  });

  it("offers Next Aggregated and Exit on the Mirage sample", async () => {
    const state = bannerState(TUTORIAL_ID);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.getByText("Tutorial")).toBeInTheDocument();
    expect(screen.getByText(/Mirage/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next: Aggregated" })).toHaveAttribute(
      "href",
      "/analyzer?tutorial=aggregated",
    );
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exit tutorial" }));
    expect(state.session.close).toHaveBeenCalledOnce();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("offers Next Playbook on the habits series", () => {
    const state = bannerState("tutorial-series|de_dust2|0");
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/analyzer?tutorial=aggregated">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.getByRole("link", { name: "Next: Playbook" })).toHaveAttribute(
      "href",
      expect.stringContaining("/playbook?"),
    );
    expect(screen.getByRole("link", { name: "Next: Playbook" })).toHaveAttribute(
      "href",
      expect.stringContaining("tutorial=playbook"),
    );
    expect(screen.getByRole("link", { name: "Mirage sample" })).toHaveAttribute(
      "href",
      "/analyzer?tutorial=1",
    );
  });

  it("finishes the tour from the playbook step", async () => {
    const state = bannerState(null);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/playbook?tutorial=playbook">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.getByText(/playbook/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(updateSettings).toHaveBeenCalledWith({ tutorialCompleted: true });
    expect(state.session.close).toHaveBeenCalledOnce();
  });
});
