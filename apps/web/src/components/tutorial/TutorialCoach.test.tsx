import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
      <button type="button" data-tutorial="review">
        Review
      </button>
      <div data-tutorial="hud">HUD</div>
      <button type="button" data-tutorial="util" data-tutorial-action="open-util">
        Utility
      </button>
      <button type="button" data-tutorial="util-throw" data-tutorial-action="jump-grenade">
        Smoke
      </button>
      <button type="button" data-tutorial="snapshot">
        Snapshot to playbook
      </button>
      <button type="button" data-tutorial="pdf">
        Export PDF
      </button>
      <span data-tutorial="bookmark">Bookmark</span>
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
      <div data-tutorial="rounds">Round bar</div>
      <select data-tutorial="player-filter" aria-label="Filter habits by player" defaultValue="">
        <option value="">All players</option>
        <option value="donk">donk</option>
      </select>
      <div data-tutorial="trails">Trails Overall</div>
      <button type="button" data-tutorial="snapshot">
        Snapshot to playbook
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

async function clickCoachNext() {
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("TutorialCoach", () => {
  beforeEach(() => {
    settingsMocks.tutorialCompleted = false;
    settingsMocks.ready = true;
    settingsMocks.update.mockReset();
  });

  it("advances Single steps only on Next, not Play, draw, or Notes", async () => {
    render(
      <TestRouter path="/tutorial/single">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial coach" })).toBeInTheDocument();
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText("Round timeline"), { target: { value: "10" } });
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();

    await clickCoachNext();
    expect(screen.getByText(/Use the toolbar to select a tool/)).toBeInTheDocument();

    emitTutorialCoachAction("draw");
    expect(screen.getByText(/Use the toolbar to select a tool/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Open Notes to review what you marked/)).toBeInTheDocument();
    expect(screen.getByText(/ephemeral/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByText(/Open Notes to review what you marked/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Open the Review tab/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Open the Review tab/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Switch to the Utility tab/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Click a grenade in the list/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Smoke" }));
    expect(screen.getByText(/Click a grenade in the list/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Take a snapshot of this analyzer view/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Notes can be exported to PDF/)).toBeInTheDocument();
    expect(screen.getByText(/must have a bookmark/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Continue to Aggregated/)).toBeInTheDocument();
  });

  it("persists a skip and still offers Next", async () => {
    render(
      <TestRouter path="/tutorial/single">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
    expect(settingsMocks.update).toHaveBeenCalledWith({
      tutorialCompleted: true,
    });
  });

  it("walks Aggregated steps on Next, not side or player filter changes", async () => {
    render(
      <TestRouter path="/tutorial/aggregated">
        <AggregatedTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByText(/Switch CT and T/)).toBeInTheDocument();
    expect(screen.getByText(/all rounds can be viewed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "T" }));
    expect(screen.getByText(/Switch CT and T/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Filter players from the selected team/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter habits by player"), {
      target: { value: "donk" },
    });
    expect(screen.getByText(/Filter players from the selected team/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Turn Trails on and set Paths to Overall/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Snapshot this Aggregated overlay/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Open the sample Playbook/)).toBeInTheDocument();
  });

  it("walks Playbook sample strats, tools, Strat notes, and PDF on Next only", async () => {
    render(
      <TestRouter path="/tutorial/playbook">
        <button type="button" data-tutorial="strat" data-tutorial-action="open-strat">
          Habits snapshot
        </button>
        <div data-tutorial="playbook-tools">Playbook tools</div>
        <textarea data-tutorial="strat-notes" aria-label="Strat notes" />
        <button type="button" data-tutorial="playbook-pdf">
          Tutorial
        </button>
        <button type="button" data-tutorial="finish" data-tutorial-action="finish">
          Finish
        </button>
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByText(/Open the sample strats in the tree/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Habits snapshot" }));
    expect(screen.getByText(/Open the sample strats in the tree/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Add CT\/T pawns and grenades/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Fill Strat notes/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Strat notes" }), {
      target: { value: "A execute from palace" },
    });
    expect(screen.getByText(/Fill Strat notes/)).toBeInTheDocument();
    await clickCoachNext();
    expect(screen.getByText(/Playbook notes export to PDF/)).toBeInTheDocument();
    await clickCoachNext();
    expect(
      screen.getByText(/Finish the tutorial to open the Analyzer drop zone/),
    ).toBeInTheDocument();
  });

  it("still shows callouts after tutorialCompleted is stored", () => {
    settingsMocks.tutorialCompleted = true;
    render(
      <TestRouter path="/tutorial/single">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial coach" })).toBeInTheDocument();
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
  });

  it("shows callouts before IndexedDB settings are ready", () => {
    settingsMocks.ready = false;
    render(
      <TestRouter path="/tutorial/single">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial coach" })).toBeInTheDocument();
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
  });

  it("does not mount on the /tutorial hub", () => {
    render(
      <TestRouter path="/tutorial">
        <SingleTargets />
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
  });

  it("shows the first callout even before the play control is in the document", () => {
    render(
      <TestRouter path="/tutorial/single">
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial coach" })).toBeInTheDocument();
    expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});
