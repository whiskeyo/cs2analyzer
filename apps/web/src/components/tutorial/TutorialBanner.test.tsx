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

  it("offers Aggregated, a playbook stub, and Exit on the Mirage sample", async () => {
    const state = bannerState(TUTORIAL_ID);
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialBanner />
      </TestRouter>,
    );
    expect(screen.getByText("Tutorial")).toBeInTheDocument();
    expect(screen.getByText(/Mirage/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try Aggregated" })).toHaveAttribute(
      "href",
      "/analyzer?tutorial=aggregated",
    );
    expect(screen.getByText("Playbook tour — next")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exit tutorial" }));
    expect(state.session.close).toHaveBeenCalledOnce();
  });
});
