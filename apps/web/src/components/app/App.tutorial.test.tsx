import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Replay } from "@/lib/replay/replayTypes";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import { TUTORIAL_FILENAME } from "@/lib/tutorial/identity";
import { resetTutorialInstallState } from "@/lib/tutorial/useTutorial";
import { App } from "./App";

const loadMocks = vi.hoisted(() => ({
  loadTutorialReplay: vi.fn(),
  loadTutorialSeries: vi.fn(),
  loadTutorialPlaybook: vi.fn(),
  isTutorialSeriesReady: vi.fn(() => false),
}));

vi.mock("@/lib/tutorial/load", () => ({
  loadTutorialReplay: loadMocks.loadTutorialReplay,
  loadTutorialSeries: loadMocks.loadTutorialSeries,
  loadTutorialPlaybook: loadMocks.loadTutorialPlaybook,
  isTutorialSeriesReady: loadMocks.isTutorialSeriesReady,
  peekTutorialSeries: () => null,
}));

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(async () => ({ de_mirage: UNIT_CALIBRATION })),
  };
});

vi.mock("@/lib/parse/ensureParser", () => ({
  ensureParser: vi.fn(async () => () => ({ terminate() {} })),
  parserFactory: vi.fn(() => null),
  prefetchParser: vi.fn(),
  discardParserWarmup: vi.fn(),
}));

function fixtureReplay(): Replay {
  return makeReplay({
    header: { map_name: "de_mirage", team_ct: "Astralis", team_t: "Vitality" },
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [
      makeRound({
        number: 1,
        winner: "CT",
        start_tick: 200,
        freeze_end_tick: 264,
        end_tick: 900,
      }),
      makeRound({
        number: 2,
        winner: "CT",
        start_tick: 1000,
        freeze_end_tick: 1064,
        end_tick: 1600,
      }),
    ],
    ticks: makeFreezeTicks(4, 2, 264),
    kills: [makeKill(400, 0, 2)],
  });
}

describe("App tutorial", () => {
  const replay = fixtureReplay();

  beforeEach(() => {
    resetTutorialInstallState();
    window.history.replaceState({}, "", "/");
    loadMocks.loadTutorialReplay.mockReset();
    loadMocks.loadTutorialSeries.mockReset();
    loadMocks.loadTutorialPlaybook.mockReset();
    loadMocks.loadTutorialReplay.mockResolvedValue(replay);
    loadMocks.loadTutorialSeries.mockResolvedValue(null);
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("opens the tutorial hub from the drop-zone text link", async () => {
    render(<App createWorker={() => ({ terminate() {} }) as Worker} />);
    await userEvent.click(screen.getByRole("link", { name: "try the Tutorial first" }));
    expect(await screen.findByRole("heading", { name: "Tutorial" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start tutorial" })).toHaveAttribute(
      "href",
      "/tutorial/single",
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit tutorial" })).not.toBeInTheDocument();
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalled();
    expect(loadMocks.loadTutorialPlaybook).not.toHaveBeenCalled();
  });

  it("starts visible coach marks on /tutorial/single from the hub CTA", async () => {
    render(<App createWorker={() => ({ terminate() {} }) as Worker} />);
    await userEvent.click(screen.getByRole("link", { name: "try the Tutorial first" }));
    await userEvent.click(await screen.findByRole("link", { name: "Start tutorial" }));
    expect(
      await screen.findByRole("complementary", { name: "Tutorial coach" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit tutorial" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next: Multiple demos" })).toBeInTheDocument();
    await waitFor(() => expect(loadMocks.loadTutorialReplay).toHaveBeenCalled());
    expect(await screen.findByText(new RegExp(TUTORIAL_FILENAME))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exit tutorial" }));
    expect(await screen.findByRole("link", { name: "try the Tutorial first" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit tutorial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading tutorial…")).not.toBeInTheDocument();
  });

  it("shows the first coach-mark callout when Single mounts with the tour active", async () => {
    window.history.replaceState({}, "", "/tutorial/single");
    render(<App createWorker={() => ({ terminate() {} }) as Worker} />);
    await waitFor(() => {
      expect(screen.getByRole("complementary", { name: "Tutorial coach" })).toBeInTheDocument();
      expect(screen.getByText(/Press Play or drag the round timeline/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    });
    await waitFor(() => expect(loadMocks.loadTutorialReplay).toHaveBeenCalled());
  });

  it("reloads the sample from /tutorial/single after a refresh", async () => {
    window.history.replaceState({}, "", "/tutorial/single");
    render(<App createWorker={() => ({ terminate() {} }) as Worker} />);
    expect(document.title).toBe("CS2 Analyzer — Tutorial");
    expect(screen.getByRole("button", { name: "Exit tutorial" })).toBeInTheDocument();
    await waitFor(() => expect(loadMocks.loadTutorialReplay).toHaveBeenCalled());
  });

  it("opens the empty Analyzer drop zone after leaving /tutorial/single via site nav", async () => {
    window.history.replaceState({}, "", "/tutorial/single");
    render(<App createWorker={() => ({ terminate() {} }) as Worker} />);
    await waitFor(() => expect(loadMocks.loadTutorialReplay).toHaveBeenCalled());
    expect(await screen.findByText(new RegExp(TUTORIAL_FILENAME))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(await screen.findByText("Drop a demo")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(TUTORIAL_FILENAME))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit tutorial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "try the Tutorial first" })).toBeInTheDocument();
  });
});
