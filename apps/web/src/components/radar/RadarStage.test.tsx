import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_HABITS_NADE_FILTER, type SeriesOverlay } from "@/lib/parse/seriesOverlay";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { Side } from "@/lib/replay/replayTypes";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { RadarStage } from "./RadarStage";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("./RadarCanvas", () => ({
  RadarCanvas: () => <canvas data-testid="radar-canvas" />,
}));

function radarState(replay = makeReplay()) {
  const setPaletteId = vi.fn();
  const setColor = vi.fn();
  const commitStrokes = vi.fn();
  const undo = vi.fn();
  const setPlaying = vi.fn();
  const setLayers = vi.fn();
  return {
    session: {
      replay,
      fileName: "match.dem",
      series: null as { mapName: string; focalTeam: string; demos: unknown[] } | null,
    },
    playback: { tick: 100, setPlaying, jump: vi.fn() },
    review: {
      color: COLOR_PRESETS[0].colors[0],
      paletteId: COLOR_PRESETS[0].id,
      floorMode: "auto",
      strokes: [
        { type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] },
        { type: "bookmark", round: 1, color: "#fff", text: "Peek" },
      ],
      canUndo: true,
      canRedo: false,
      setColor,
      setPaletteId,
      setFloorMode: vi.fn(),
      undo,
      redo: vi.fn(),
      commitStrokes,
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
    cal: { pos_x: 0, pos_y: 1024, scale: 1, radar: "test.png", lower_radar: "lower.png" },
    habits: {
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
    _actions: { setPaletteId, setColor, commitStrokes, undo, setPlaying, setLayers },
  };
}

describe("RadarStage", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders nothing without a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue({
      session: { replay: null },
    } as unknown as ReturnType<typeof useApp>);
    const { container } = render(<RadarStage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the radar column when a replay is loaded", () => {
    vi.mocked(useApp).mockReturnValue(radarState() as unknown as ReturnType<typeof useApp>);
    const { container } = render(<RadarStage />);
    expect(container.querySelector(".radar-col")).toBeInTheDocument();
    expect(screen.getByTestId("radar-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draw" })).toBeInTheDocument();
  });

  it("wires undo, clear, and bookmark actions from the toolbar", async () => {
    const state = radarState(
      makeReplay({
        rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      }),
    );
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<RadarStage />);

    await userEvent.click(screen.getByRole("button", { name: "Undo drawing (Ctrl+Z)" }));
    expect(state._actions.undo).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Clear drawings on this round" }));
    expect(state._actions.commitStrokes).toHaveBeenCalledWith([
      expect.objectContaining({ type: "bookmark" }),
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Bookmark this tick/ }));
    expect(state._actions.commitStrokes).toHaveBeenCalledTimes(2);
    expect(state._actions.commitStrokes.mock.calls[1][0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "bookmark" })]),
    );
  });

  it("resets the active color when the palette changes", async () => {
    const state = radarState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<RadarStage />);

    await userEvent.click(screen.getByRole("button", { name: "Night" }));
    expect(state._actions.setPaletteId).toHaveBeenCalledWith("night");
    expect(state._actions.setColor).toHaveBeenCalledWith("#b04cff");
  });

  it("pauses playback when summary is enabled", async () => {
    const state = radarState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<RadarStage />);

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
      heatDots: [],
      nades: [],
      roundCount: 0,
      windowSec: 5,
    };
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<RadarStage />);
    expect(screen.queryByRole("button", { name: /Round autoplay/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snapshot to playbook" })).toBeInTheDocument();
  });

  it("opens the snapshot dialog from the toolbar", async () => {
    vi.mocked(useApp).mockReturnValue(radarState() as unknown as ReturnType<typeof useApp>);
    render(<RadarStage />);
    await userEvent.click(screen.getByRole("button", { name: "Snapshot to playbook" }));
    expect(screen.getByRole("dialog", { name: "Snapshot to playbook" })).toBeInTheDocument();
  });

  it("titles an aggregated snapshot from the series bucket", async () => {
    const state = radarState();
    state.habits.overlay = {
      trails: [],
      heatDots: [],
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
    render(<RadarStage />);
    await userEvent.click(screen.getByRole("button", { name: "Snapshot to playbook" }));
    expect(screen.getByRole("textbox", { name: "Strat name" })).toHaveValue(
      "Spirit series (12 demos) · CT pistol · 0:24",
    );
  });
});
