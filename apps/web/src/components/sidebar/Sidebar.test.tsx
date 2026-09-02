import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { playerIdentityKey } from "@/lib/parse/seriesRoster";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { Sidebar } from "./Sidebar";

function mockPointerCapture(el: HTMLElement) {
  el.setPointerCapture = vi.fn();
  el.releasePointerCapture = vi.fn();
  el.hasPointerCapture = vi.fn(() => true);
}

function stageShell() {
  const stage = document.createElement("div");
  stage.className = "stage";
  Object.defineProperty(stage, "clientWidth", { value: 1200, configurable: true });
  document.body.appendChild(stage);
  return stage;
}

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

function sidebarReplay() {
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, end_tick: 640 })],
    kills: [makeKill(200, 0, 2, { weapon: "ak47", headshot: true })],
    ticks: makeFreezeTicks(4, 2),
  });
}

function sidebarProps(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return {
    replay: sidebarReplay(),
    tick: 640,
    strokes: [],
    selected: null,
    onSelect: vi.fn(),
    onJump: vi.fn(),
    onStrokes: vi.fn(),
    places: null,
    ...overrides,
  };
}

function sidebarAppState(overrides: Record<string, unknown> = {}) {
  return {
    session: { series: null },
    view: { setFollow: vi.fn() },
    habits: {
      aggregated: false,
      playerKey: null,
      focalPlayers: [],
      seriesActionBeats: [],
      seriesUtilThrows: [],
      playRound: vi.fn(),
      filter: { side: "CT", kind: "full" },
      util: null,
      utilSets: null,
      action: null,
      ...overrides,
    },
  };
}

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
    vi.mocked(useApp).mockReturnValue(sidebarAppState() as unknown as ReturnType<typeof useApp>);
  });

  it("starts on the scoreboard tab", () => {
    render(<Sidebar {...sidebarProps()} />);
    expect(screen.getByRole("button", { name: "Score" })).toHaveClass("on");
    expect(screen.getByText("Astralis")).toBeInTheDocument();
  });

  it("switches tabs", async () => {
    render(<Sidebar {...sidebarProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByRole("button", { name: "Notes" })).toHaveClass("on");
    expect(screen.getByText(/Draw or add a text box/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Weapons" }));
    expect(screen.getByRole("button", { name: "Weapons" })).toHaveClass("on");
    expect(screen.getByText("Select a player or view match totals")).toBeInTheDocument();
  });

  it("opens rounds and review tabs and has no clutch tab", async () => {
    render(<Sidebar {...sidebarProps()} />);
    expect(screen.queryByRole("button", { name: "Clutch" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Rounds" }));
    expect(screen.getByRole("button", { name: "Rounds" })).toHaveClass("on");
    expect(screen.getByText("R1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Review" })).toHaveClass("on");
    expect(screen.getByText(/Select a player/)).toBeInTheDocument();
  });

  it("shows weapon rows and clears the selected player", async () => {
    const onSelect = vi.fn();
    render(<Sidebar {...sidebarProps({ selected: 0, onSelect })} />);

    await userEvent.click(screen.getByRole("button", { name: "Weapons" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("AK-47")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All game" })).toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Until now" }));
    expect(screen.getByRole("button", { name: "Until now" })).toHaveClass("on");

    await userEvent.click(screen.getByRole("button", { name: "(all)" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows the rating hint for a selected player on score", () => {
    render(<Sidebar {...sidebarProps({ selected: 0 })} />);
    expect(screen.getByText(/rating through this tick/)).toBeInTheDocument();
  });

  it("shows series bucket content in aggregated action view", async () => {
    const demoA = loadedDemo(makeReplay(), "a.dem", new File([], "a.dem"));
    const demoB = loadedDemo(makeReplay(), "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_mirage", [demoA, demoB], "Team A");
    vi.mocked(useApp).mockReturnValue(
      sidebarAppState({
        aggregated: true,
        seriesActionBeats: [],
        util: { roundCount: 2, entries: [{ kind: "smoke", callout: "A", count: 1 }] },
        utilSets: { roundCount: 2, entries: [{ key: "a", label: "A smokes", count: 1 }] },
        action: { roundCount: 1, entries: [{ title: "A execute", count: 1 }] },
      }) as unknown as ReturnType<typeof useApp>,
    );
    vi.mocked(useApp).mockReturnValue({
      session: { series },
      habits: {
        aggregated: true,
        playerKey: null,
        focalPlayers: [],
        seriesActionBeats: [],
        seriesUtilThrows: [],
        playRound: vi.fn(),
        filter: { side: "CT", kind: "full" },
        util: { roundCount: 2, entries: [{ kind: "smoke", callout: "A", count: 1 }] },
        utilSets: { roundCount: 2, entries: [{ key: "a", label: "A smokes", count: 1 }] },
        action: { roundCount: 1, entries: [{ title: "A execute", count: 1 }] },
      },
    } as unknown as ReturnType<typeof useApp>);

    render(<Sidebar {...sidebarProps()} />);
    expect(screen.getByRole("button", { name: "Action" })).toHaveClass("on");
    expect(screen.getByText(/Team A · CT full/)).toBeInTheDocument();
    expect(screen.getByText("A execute")).toBeInTheDocument();
  });

  it("opens the utility tab for single-demo matches", async () => {
    render(<Sidebar {...sidebarProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Utility" }));
    expect(screen.getByRole("button", { name: "Utility" })).toHaveClass("on");
  });

  it("shows player review when a series player is selected", async () => {
    const focal = "Team A";
    const demoA = loadedDemo(
      makeReplay({
        header: { team_ct: focal, team_t: "B" },
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(200, 0, 1)],
      }),
      "a.dem",
      new File([], "a.dem"),
    );
    const demoB = loadedDemo(makeReplay(), "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_mirage", [demoA, demoB], focal);
    vi.mocked(useApp).mockReturnValue({
      session: { series },
      habits: {
        aggregated: false,
        playerKey: playerIdentityKey(demoA.replay, 0),
        focalPlayers: [{ key: playerIdentityKey(demoA.replay, 0), name: "Donk" }],
        seriesActionBeats: [],
        seriesUtilThrows: [],
        playRound: vi.fn(),
        filter: { side: "CT", kind: "full" },
        util: null,
        utilSets: null,
        action: null,
      },
    } as unknown as ReturnType<typeof useApp>);

    render(<Sidebar {...sidebarProps()} />);
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Donk/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review sort" })).toBeInTheDocument();
  });

  it("opens single-demo review from the sidebar", async () => {
    render(<Sidebar {...sidebarProps({ selected: 0 })} />);
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review sort" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Review note kinds" })).not.toBeInTheDocument();
  });

  it("resizes with the separator handle", () => {
    const stage = stageShell();

    render(<Sidebar {...sidebarProps()} />);
    const handle = screen.getByRole("separator", { name: "Resize side panel" });
    mockPointerCapture(handle);
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(document.body.classList.contains("sidebar-resizing")).toBe(false);
    stage.remove();
  });

  it("snaps to minimum width on double click", async () => {
    const stage = stageShell();

    render(<Sidebar {...sidebarProps()} />);
    mockPointerCapture(screen.getByRole("separator", { name: "Resize side panel" }));
    await userEvent.dblClick(screen.getByRole("separator", { name: "Resize side panel" }));
    expect(screen.getByRole("separator", { name: "Resize side panel" })).toHaveAttribute(
      "aria-valuenow",
      "400",
    );
    stage.remove();
  });
});
