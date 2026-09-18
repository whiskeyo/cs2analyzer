import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestRouter } from "@/lib/testing/router";
import { tutorialHref } from "@/lib/tutorial/query";
import { TutorialStart } from "./TutorialStart";

const settingsMocks = vi.hoisted(() => ({
  tutorialCompleted: false,
  ready: true,
  update: vi.fn(),
}));

const warmup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tutorial/prefetch", () => ({
  warmupTutorialSession: warmup,
}));

vi.mock("@/lib/settings/useUserSettings", () => ({
  useUserSettings: () => ({
    settings: { tutorialCompleted: settingsMocks.tutorialCompleted },
    ready: settingsMocks.ready,
    saveError: null,
    update: settingsMocks.update,
    reset: vi.fn(),
  }),
}));

describe("TutorialStart", () => {
  beforeEach(() => {
    settingsMocks.tutorialCompleted = false;
    settingsMocks.ready = true;
    settingsMocks.update.mockReset();
    warmup.mockReset();
  });

  it("links Home and Analyzer empty states at ?tutorial=1", () => {
    render(
      <TestRouter>
        <TutorialStart />
      </TestRouter>,
    );
    const link = screen.getByRole("link", { name: "Try without a demo" });
    expect(link).toHaveAttribute("href", tutorialHref("replay"));
    expect(link).toHaveAttribute("href", "/analyzer?tutorial=1");
    expect(screen.getByText(/Mirage sample/)).toBeInTheDocument();
  });

  it("warms Replay and Aggregated fixtures on pointer down", () => {
    render(
      <TestRouter>
        <TutorialStart />
      </TestRouter>,
    );
    fireEvent.pointerDown(screen.getByRole("link", { name: "Try without a demo" }));
    expect(warmup).toHaveBeenCalledOnce();
  });

  it("marks the tour completed from Don't show again", async () => {
    render(
      <TestRouter>
        <TutorialStart />
      </TestRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(settingsMocks.update).toHaveBeenCalledWith({
      tutorialCompleted: true,
    });
  });

  it("hides Don't show again after the tour is completed", () => {
    settingsMocks.tutorialCompleted = true;
    render(
      <TestRouter>
        <TutorialStart />
      </TestRouter>,
    );
    expect(screen.getByRole("link", { name: "Try without a demo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Don't show again" })).not.toBeInTheDocument();
  });

  it("keeps the compact Analyzer CTA without Don't show again", () => {
    render(
      <TestRouter>
        <TutorialStart compact />
      </TestRouter>,
    );
    expect(screen.queryByRole("button", { name: "Don't show again" })).not.toBeInTheDocument();
  });
});
