import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
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

function PathProbe() {
  const { pathname } = useLocation();
  return <span data-testid="path">{pathname}</span>;
}

describe("TutorialBanner", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    updateSettings.mockReset();
  });

  it("hides on /analyzer even if a tutorial demo id is still installed", () => {
    vi.mocked(useApp).mockReturnValue(
      bannerState(TUTORIAL_ID) as unknown as ReturnType<typeof useApp>,
    );
    render(
      <TestRouter path="/analyzer">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();
  });

  it("offers Next Multiple demos and Exit on the single-demo panel", async () => {
    const state = bannerState(TUTORIAL_ID);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/tutorial/single">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.getByText("Tutorial")).toBeInTheDocument();
    expect(screen.getByText("Sample of two rounds from GOTV demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/tutorial");
    expect(screen.getByRole("link", { name: "Next: Multiple demos" })).toHaveAttribute(
      "href",
      "/tutorial/aggregated",
    );
    expect(screen.getByRole("link", { name: "Next: Multiple demos" })).toHaveAttribute(
      "data-tutorial",
      "next-aggregated",
    );
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exit tutorial" }));
    expect(state.session.close).toHaveBeenCalledOnce();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("offers previous Single demo and Next Playbook on the multiple-demos panel", () => {
    const state = bannerState("tutorial-series|de_dust2|0");
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/tutorial/aggregated">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.getByRole("link", { name: "Next: Playbook" })).toHaveAttribute(
      "href",
      "/tutorial/playbook",
    );
    expect(screen.getByRole("link", { name: "Previous: Single demo" })).toHaveAttribute(
      "href",
      "/tutorial/single",
    );
  });

  it("finishes the tour from the playbook step", async () => {
    const state = bannerState(null);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/tutorial/playbook">
        <TutorialBanner />
        <PathProbe />
      </TestRouter>,
    );
    expect(screen.getByText(/Sample Playbook/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous: Multiple demos" })).toHaveAttribute(
      "href",
      "/tutorial/aggregated",
    );
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(updateSettings).toHaveBeenCalledWith({ tutorialCompleted: true });
    expect(state.session.close).toHaveBeenCalledOnce();
    expect(screen.getByTestId("path")).toHaveTextContent("/analyzer");
  });
});
