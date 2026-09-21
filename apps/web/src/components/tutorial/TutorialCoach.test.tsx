import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestRouter } from "@/lib/testing/router";
import { emitTutorialCoachAction } from "@/lib/tutorial/coachAction";
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

function SingleTargets() {
  return (
    <>
      <div data-tutorial="play">
        <button type="button" data-tutorial-action="play-or-scrub">
          Play
        </button>
        <input aria-label="Round timeline" type="range" data-tutorial-action="play-or-scrub" />
      </div>
      <div data-tutorial="draw">Draw tools</div>
      <button type="button" data-tutorial="notes" data-tutorial-action="open-notes">
        Notes
      </button>
      <a
        href="/tutorial/aggregated"
        data-tutorial="next-aggregated"
        data-tutorial-action="next-aggregated"
      >
        Next: Multiple demos
      </a>
    </>
  );
}

function AggregatedTargets() {
  return (
    <>
      <div data-tutorial="side">
        <button type="button" data-tutorial-action="switch-side">
          T
        </button>
      </div>
      <button type="button" data-tutorial="util" data-tutorial-action="open-util">
        Utility
      </button>
      <button type="button" data-tutorial="util-throw" data-tutorial-action="jump-grenade">
        Smoke
      </button>
      <button type="button" data-tutorial="buy" data-tutorial-action="toggle-buy">
        Full
      </button>
      <a
        href="/tutorial/playbook"
        data-tutorial="next-playbook"
        data-tutorial-action="next-playbook"
      >
        Next: Playbook
      </a>
    </>
  );
}

describe("TutorialCoach", () => {
  beforeEach(() => {
    settingsMocks.tutorialCompleted = false;
    settingsMocks.ready = true;
    settingsMocks.update.mockReset();
  });

  it("advances Single steps on real actions, not Next", async () => {
    render(
      <TestRouter path="/tutorial">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial coach" })).toBeInTheDocument();
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByText(/Use the toolbar to select a tool/)).toBeInTheDocument();

    act(() => emitTutorialCoachAction("draw"));
    expect(screen.getByText(/Open Notes to review what you marked/)).toBeInTheDocument();
    expect(screen.getByText(/ephemeral/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByText(/Continue to Aggregated/)).toBeInTheDocument();
  });

  it("treats timeline scrub as the play step action", () => {
    render(
      <TestRouter path="/tutorial">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    fireEvent.input(screen.getByLabelText("Round timeline"), {
      target: { value: "10" },
    });
    expect(screen.getByText(/Use the toolbar to select a tool/)).toBeInTheDocument();
  });

  it("persists a skip and has no Next control", async () => {
    render(
      <TestRouter path="/tutorial">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
    expect(settingsMocks.update).toHaveBeenCalledWith({
      tutorialCompleted: true,
    });
  });

  it("walks Aggregated actions including Utility and Full", async () => {
    render(
      <TestRouter path="/tutorial/aggregated">
        <AggregatedTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByText(/Switch CT and T/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "T" }));
    expect(screen.getByText(/Switch to the Utility tab/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Utility" }));
    expect(screen.getByText(/Click a grenade in the list/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Smoke" }));
    expect(screen.getByText(/Click Full/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Full" }));
    expect(screen.getByText(/Open the sample Playbook/)).toBeInTheDocument();
  });

  it("asks to open the sample strat on Playbook", async () => {
    render(
      <TestRouter path="/tutorial/playbook">
        <button type="button" data-tutorial="strat" data-tutorial-action="open-strat">
          Tutorial strat
        </button>
        <button type="button" data-tutorial="finish" data-tutorial-action="finish">
          Finish
        </button>
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByText(/Open the Tutorial strat in the tree/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tutorial strat" }));
    expect(
      screen.getByText(/Finish the tutorial to open the Analyzer drop zone/),
    ).toBeInTheDocument();
  });

  it("stays dismissed after tutorialCompleted is stored", () => {
    settingsMocks.tutorialCompleted = true;
    render(
      <TestRouter path="/tutorial">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
  });

  it("waits for IndexedDB settings before showing callouts", () => {
    settingsMocks.ready = false;
    render(
      <TestRouter path="/tutorial">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
  });
});
