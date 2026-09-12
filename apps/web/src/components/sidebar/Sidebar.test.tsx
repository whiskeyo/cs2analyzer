/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
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

function sidebarAppState({
  replay = sidebarReplay(),
  selected = null,
  onSelect = vi.fn(),
  session = {},
  habits = {},
}: {
  replay?: ReturnType<typeof sidebarReplay>;
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  session?: Record<string, unknown>;
  habits?: Record<string, unknown>;
} = {}) {
  return {
    session: { series: null, replay, ...session },
    playback: { tick: 640, jump: vi.fn(), activeRound: null },
    review: { notes: [], commitNotes: vi.fn() },
    view: { selected, select: onSelect, setFollow: vi.fn() },
    places: null,
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
      ...habits,
    },
  };
}

function mockSidebar(overrides?: Parameters<typeof sidebarAppState>[0]) {
  vi.mocked(useApp).mockReturnValue(
    sidebarAppState(overrides) as unknown as ReturnType<typeof useApp>,
  );
}

describe("Sidebar", () => {
  beforeEach(async () => {
    vi.mocked(useApp).mockReset();
    mockSidebar();
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await clearUserSettingsForTests();
  });

  it("starts on the scoreboard tab", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: "Score" })).toHaveClass("on");
    expect(screen.getByText("Astralis")).toBeInTheDocument();
  });

  it("opens the Notes tab when that is the Preferences default", async () => {
    await saveUserSettings({ defaultSidebarTab: "notes" });
    render(
      <UserSettingsProvider>
        <Sidebar />
      </UserSettingsProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Notes" })).toHaveClass("on"));
    expect(screen.getByText(/Draw or add a text box/)).toBeInTheDocument();
  });

  it("keeps the tab the user picked when the default later changes", async () => {
    render(
      <UserSettingsProvider>
        <Sidebar />
      </UserSettingsProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByRole("button", { name: "Notes" })).toHaveClass("on");
    await saveUserSettings({ defaultSidebarTab: "rounds" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Notes" })).toHaveClass("on"));
    expect(screen.getByRole("button", { name: "Rounds" })).not.toHaveClass("on");
  });

  it("switches tabs", async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByRole("button", { name: "Notes" })).toHaveClass("on");
    expect(screen.getByText(/Draw or add a text box/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Weapons" }));
    expect(screen.getByRole("button", { name: "Weapons" })).toHaveClass("on");
    expect(screen.getByText("Select a player or view match totals")).toBeInTheDocument();
  });

  it("opens rounds and review tabs and has no clutch tab", async () => {
    render(<Sidebar />);
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
    mockSidebar({ selected: 0, onSelect });
    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: "Weapons" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("AK-47")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All game" })).toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Until now" }));
    expect(screen.getByRole("button", { name: "Until now" })).toHaveClass("on");

    await userEvent.click(screen.getByRole("button", { name: "(all)" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("omits headshot percent for grenades", async () => {
    const replay = sidebarReplay();
    replay.kills.push(makeKill(300, 0, 2, { weapon: "hegrenade" }));
    mockSidebar({ replay, selected: 0 });
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Weapons" }));
    expect(screen.getByText("AK-47").closest("tr")).toHaveTextContent("100%");
    expect(screen.getByText("HE").closest("tr")).not.toHaveTextContent("%");
  });

  it("shows the rating hint for a selected player on score", () => {
    mockSidebar({ selected: 0 });
    render(<Sidebar />);
    expect(screen.getByText(/rating through this tick/)).toBeInTheDocument();
  });

  it("shows series bucket content in aggregated action view", async () => {
    const demoA = loadedDemo(makeReplay(), "a.dem", new File([], "a.dem"));
    const demoB = loadedDemo(makeReplay(), "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_mirage", [demoA, demoB], "Team A");
    mockSidebar({
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
    });

    render(<Sidebar />);
    expect(screen.getByRole("button", { name: "Action" })).toHaveClass("on");
    expect(screen.getByText(/Team A · CT full/)).toBeInTheDocument();
    expect(screen.getByText("A execute")).toBeInTheDocument();
  });

  it("opens the utility tab for single-demo matches", async () => {
    render(<Sidebar />);
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
    mockSidebar({
      replay: demoA.replay,
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
    });

    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Donk/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review sort" })).toBeInTheDocument();
  });

  it("opens single-demo review from the sidebar", async () => {
    mockSidebar({ selected: 0 });
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Review sort" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Review note kinds" })).not.toBeInTheDocument();
  });

  it("resizes with the separator handle", () => {
    const stage = stageShell();

    render(<Sidebar />);
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

    render(<Sidebar />);
    mockPointerCapture(screen.getByRole("separator", { name: "Resize side panel" }));
    await userEvent.dblClick(screen.getByRole("separator", { name: "Resize side panel" }));
    expect(screen.getByRole("separator", { name: "Resize side panel" })).toHaveAttribute(
      "aria-valuenow",
      "400",
    );
    stage.remove();
  });
});
