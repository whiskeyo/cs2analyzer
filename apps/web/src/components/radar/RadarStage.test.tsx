import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as playbookStore from "@/lib/playbook/playbookStore";
import { SNAPSHOT_RECENT_BOOKS_KEY } from "@/lib/shared/storageKeys";
import { useApp } from "@/lib/state/appState";
import type { Note } from "@/lib/notes/types";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_HABITS_NADE_FILTER, type SeriesOverlay } from "@/lib/parse/seriesOverlay";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { Side } from "@/lib/replay/replayTypes";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { TestRouter } from "@/lib/testing/router";
import { RadarStage } from "./RadarStage";

function renderStage(ui = <RadarStage />) {
  return render(<TestRouter>{ui}</TestRouter>);
}

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

const canvasProbe = { note: null as Note | null };

vi.mock("./RadarCanvas", () => ({
  RadarCanvas: (props: { note: Note }) => {
    canvasProbe.note = props.note;
    return <canvas data-testid="radar-canvas" />;
  },
}));

function radarState(replay = makeReplay()) {
  const setPaletteId = vi.fn();
  const setColor = vi.fn();
  const commitNotes = vi.fn();
  const undo = vi.fn();
  const setPlaying = vi.fn();
  const setLayers = vi.fn();
  return {
    session: {
      replay,
      fileName: "match.dem",
      series: null as {
        mapName: string;
        focalTeam: string;
        demos: unknown[];
      } | null,
    },
    playback: { tick: 100, setPlaying, jump: vi.fn() },
    review: {
      color: COLOR_PRESETS[0].colors[0],
      paletteId: COLOR_PRESETS[0].id,
      floorMode: "auto",
      notes: [
        {
          round: 1,
          note: {
            groups: [],
            drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
            pieces: [],
            bookmarks: [{ color: "#fff", text: "Peek", tick: 100 }],
          },
        },
      ],
      canUndo: true,
      canRedo: false,
      setColor,
      setPaletteId,
      setFloorMode: vi.fn(),
      undo,
      redo: vi.fn(),
      commitNotes,
      summaryFilter: DEFAULT_SUMMARY_FILTER,
      setSummaryFilter: vi.fn(),
    },
    view: {
      tool: "pan",
      follow: false,
      trails: true,
      moment: false,
      selected: 0,
      layers: { ...DEFAULT_LAYERS },
      setTool: vi.fn(),
      setFollow: vi.fn(),
      setTrails: vi.fn(),
      setMoment: vi.fn(),
      setLayers,
      resetView: vi.fn(),
      select: vi.fn(),
      viewEpoch: 0,
    },
    cal: {
      pos_x: 0,
      pos_y: 1024,
      scale: 1,
      radar: "test.png",
      lower_radar: "lower.png",
    },
    habits: {
      aggregated: false,
      overlayOn: true,
      overlay: null as SeriesOverlay | null,
      overlayDisplay: null,
      overlayTrails: false,
      overlayArrows: false,
      nadeFilter: DEFAULT_HABITS_NADE_FILTER,
      nadesOn: true,
      nadeOpacity: 1,
      playRound: vi.fn(),
      bucketPlaySec: 0,
      bucketPlaySecRef: { current: 0 },
      bucketOverlay: null as { kind: RoundKind; side: Side } | null,
    },
    _actions: {
      setPaletteId,
      setColor,
      commitNotes,
      undo,
      setPlaying,
      setLayers,
    },
  };
}

describe("RadarStage", () => {
  beforeEach(async () => {
    canvasProbe.note = null;
    vi.mocked(useApp).mockReset();
    await playbookStore.deleteAllPlaybooks();
    localStorage.removeItem(SNAPSHOT_RECENT_BOOKS_KEY);
  });

  afterEach(async () => {
    await playbookStore.deleteAllPlaybooks();
    localStorage.removeItem(SNAPSHOT_RECENT_BOOKS_KEY);
  });

  it("renders nothing without a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue({
      session: { replay: null },
    } as unknown as ReturnType<typeof useApp>);
    const { container } = renderStage();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the radar column when a replay is loaded", () => {
    vi.mocked(useApp).mockReturnValue(radarState() as unknown as ReturnType<typeof useApp>);
    const { container } = renderStage();
    expect(container.querySelector(".radar-col")).toBeInTheDocument();
    expect(screen.getByTestId("radar-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draw" })).toBeInTheDocument();
  });

  it("clears the prior round's notes on Aggregated and restores them on a live round", () => {
    const series = {
      mapName: "de_dust2",
      focalTeam: "Spirit",
      demos: [{ id: "d1" }, { id: "d2" }],
    };
    const noted = radarState(
      makeReplay({
        rounds: [
          makeRound({
            number: 1,
            start_tick: 0,
            freeze_end_tick: 64,
            end_tick: 640,
          }),
        ],
      }),
    );
    noted.session.series = series;
    vi.mocked(useApp).mockReturnValue(noted as unknown as ReturnType<typeof useApp>);
    const { rerender } = renderStage();
    expect(canvasProbe.note?.drawings).toHaveLength(1);
    expect(canvasProbe.note?.bookmarks).toHaveLength(1);

    const aggregated = radarState(
      makeReplay({
        rounds: [
          makeRound({
            number: 1,
            start_tick: 0,
            freeze_end_tick: 64,
            end_tick: 640,
          }),
        ],
      }),
    );
    aggregated.session.series = series;
    aggregated.review.notes = noted.review.notes;
    aggregated.habits.aggregated = true;
    vi.mocked(useApp).mockReturnValue(aggregated as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toEqual([]);
    expect(canvasProbe.note?.bookmarks).toEqual([]);
    expect(canvasProbe.note?.pieces).toEqual([]);

    vi.mocked(useApp).mockReturnValue(noted as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toHaveLength(1);
    expect(canvasProbe.note?.bookmarks).toHaveLength(1);
  });

  it("wires undo, clear, and bookmark actions from the toolbar", async () => {
    const state = radarState(
      makeReplay({
        rounds: [
          makeRound({
            number: 1,
            start_tick: 0,
            freeze_end_tick: 64,
            end_tick: 640,
          }),
        ],
      }),
    );
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();

    await userEvent.click(screen.getByRole("button", { name: "Undo drawing (Ctrl+Z)" }));
    expect(state._actions.undo).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Clear drawings on this round" }));
    expect(state._actions.commitNotes).toHaveBeenCalledWith([
      expect.objectContaining({
        note: expect.objectContaining({
          drawings: [],
          bookmarks: [expect.objectContaining({ text: "Peek" })],
        }),
      }),
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Bookmark this tick/ }));
    expect(state._actions.commitNotes).toHaveBeenCalledTimes(2);
    expect(state._actions.commitNotes.mock.calls[1][0][0].note.bookmarks).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "Peek" })]),
    );
  });

  it("resets the active color when the palette changes", async () => {
    const state = radarState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();

    await userEvent.click(screen.getByRole("button", { name: "Night" }));
    expect(state._actions.setPaletteId).toHaveBeenCalledWith("night");
    expect(state._actions.setColor).toHaveBeenCalledWith("#b04cff");
  });

  it("pauses playback when summary is enabled", async () => {
    const state = radarState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();

    await userEvent.click(screen.getByRole("button", { name: "Summary" }));
    expect(state._actions.setPlaying).toHaveBeenCalledWith(false);
    expect(state._actions.setLayers).toHaveBeenCalledWith({
      ...DEFAULT_LAYERS,
      summary: true,
    });
  });

  it("hides match HUD overlays when habits overlay is active", () => {
    const state = radarState();
    state.habits.overlay = {
      trails: [],
      branches: [],
      nades: [],
      roundCount: 0,
      windowSec: 5,
    };
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();
    expect(screen.queryByRole("button", { name: /Round autoplay/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Player colours" })).toBeNull();
    expect(screen.getByRole("button", { name: "Snapshot to playbook" })).toBeInTheDocument();
  });

  it("opens the snapshot dialog from the toolbar", async () => {
    vi.mocked(useApp).mockReturnValue(radarState() as unknown as ReturnType<typeof useApp>);
    renderStage();
    await userEvent.click(screen.getByRole("button", { name: "Snapshot to playbook" }));
    expect(screen.getByRole("dialog", { name: "Snapshot to playbook" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Drawings" })).toBeChecked();
  });

  it("titles an aggregated snapshot from the series bucket", async () => {
    const state = radarState();
    state.habits.overlay = {
      trails: [],
      branches: [],
      nades: [],
      roundCount: 4,
      windowSec: 30,
    };
    state.habits.bucketPlaySec = 24;
    state.habits.bucketOverlay = { kind: "pistol", side: "CT" };
    state.session.series = {
      mapName: "de_dust2",
      focalTeam: "Spirit",
      demos: Array.from({ length: 12 }, () => ({})),
    };
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();
    await userEvent.click(screen.getByRole("button", { name: "Snapshot to playbook" }));
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue(
      "Spirit series (12 demos) · CT pistol · 0:24",
    );
  });

  it("toasts after a snapshot so the landing book is obvious", async () => {
    await playbookStore.createPlaybook("de_anubis", "A execs");
    vi.mocked(useApp).mockReturnValue(radarState() as unknown as ReturnType<typeof useApp>);
    renderStage();
    await userEvent.click(screen.getByRole("button", { name: "Snapshot to playbook" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Snapshot" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Saved to A execs/);
    expect(screen.queryByRole("dialog", { name: "Snapshot to playbook" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the pawn colour legend on a live single-demo HUD", () => {
    vi.mocked(useApp).mockReturnValue(radarState() as unknown as ReturnType<typeof useApp>);
    renderStage();
    expect(screen.queryByRole("button", { name: "Legend" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Player colours" })).toBeNull();
  });

  it("shows the pawn colour legend only for a multi-demo Aggregated overlay", () => {
    const overlay = {
      trails: [
        {
          demoId: "d1",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "donk",
          color: "#ff2d6a",
          points: [],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
        {
          demoId: "d2",
          roundNumber: 2,
          jumpTick: 64,
          tps: 64,
          steamId: 2,
          playerName: "m0NESY",
          color: "#00f0ff",
          points: [],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
      ],
      heatDots: [],
      nades: [],
      roundCount: 2,
      windowSec: 20,
    } satisfies SeriesOverlay;
    const series = {
      mapName: "de_dust2",
      focalTeam: "Spirit",
      demos: [{ id: "d1" }, { id: "d2" }],
    };

    const demosView = radarState();
    demosView.session.series = series;
    demosView.habits.overlay = overlay;
    vi.mocked(useApp).mockReturnValue(demosView as unknown as ReturnType<typeof useApp>);
    const { unmount } = renderStage();
    expect(screen.queryByRole("list", { name: "Player colours" })).toBeNull();
    unmount();

    const aggregatedNoBucket = radarState();
    aggregatedNoBucket.session.series = series;
    aggregatedNoBucket.habits.aggregated = true;
    aggregatedNoBucket.habits.overlayOn = true;
    aggregatedNoBucket.habits.overlay = overlay;
    vi.mocked(useApp).mockReturnValue(aggregatedNoBucket as unknown as ReturnType<typeof useApp>);
    const noBucket = renderStage();
    expect(screen.queryByRole("list", { name: "Player colours" })).toBeNull();
    noBucket.unmount();

    const aggregated = radarState();
    aggregated.session.series = series;
    aggregated.habits.aggregated = true;
    aggregated.habits.overlayOn = true;
    aggregated.habits.bucketOverlay = { kind: "pistol", side: "CT" };
    aggregated.habits.overlay = overlay;
    vi.mocked(useApp).mockReturnValue(aggregated as unknown as ReturnType<typeof useApp>);
    renderStage();
    const list = screen.getByRole("list", { name: "Player colours" });
    expect(list).toHaveTextContent("donk");
    expect(list).toHaveTextContent("m0NESY");
    expect(screen.queryByRole("button", { name: "Legend" })).toBeNull();
  });
});
