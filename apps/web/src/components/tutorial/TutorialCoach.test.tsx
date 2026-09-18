import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestRouter } from "@/lib/testing/router";
import { TutorialCoach } from "./TutorialCoach";

const settingsMocks = vi.hoisted(() => ({
  tutorialCompleted: false,
  ready: true,
  update: vi.fn(),
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

describe("TutorialCoach", () => {
  beforeEach(() => {
    settingsMocks.tutorialCompleted = false;
    settingsMocks.ready = true;
    settingsMocks.update.mockReset();
  });

  it("walks short callouts and persists a skip", async () => {
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial tips" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No demo required" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Radar" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("complementary", { name: "Tutorial tips" })).not.toBeInTheDocument();
    expect(settingsMocks.update).toHaveBeenCalledWith({ tutorialCompleted: true });
  });

  it("stays dismissed after tutorialCompleted is stored", () => {
    settingsMocks.tutorialCompleted = true;
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial tips" })).not.toBeInTheDocument();
  });

  it("waits for IndexedDB settings before showing callouts", () => {
    settingsMocks.ready = false;
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial tips" })).not.toBeInTheDocument();
  });
});
