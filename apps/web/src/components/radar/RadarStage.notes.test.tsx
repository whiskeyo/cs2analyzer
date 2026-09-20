import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import type { Note, RoundNote } from "@/lib/notes/types";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_HABITS_NADE_FILTER } from "@/lib/parse/seriesOverlay";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { TestRouter } from "@/lib/testing/router";
import { RadarStage } from "./RadarStage";

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

const series = {
  mapName: "de_dust2",
  focalTeam: "Spirit",
  demos: [{ id: "d1" }, { id: "d2" }],
};

function roundNote(round: number, color: string, text: string, tick: number): RoundNote {
  return {
    round,
    note: {
      groups: [],
      drawings: [{ type: "pen", color, points: [{ x: 0, y: 0 }] }],
      pieces: [],
      bookmarks: [{ color, text, tick }],
    },
  };
}

function radarState(replay = makeReplay()) {
  const commitNotes = vi.fn();
  const undo = vi.fn();
  return {
    session: {
      replay,
      fileName: "match.dem",
      demo: { id: "d1" } as { id: string } | null,
      series: series as typeof series | null,
    },
    playback: { tick: 100, setPlaying: vi.fn(), jump: vi.fn() },
    review: {
      color: COLOR_PRESETS[0].colors[0],
      paletteId: COLOR_PRESETS[0].id,
      floorMode: "auto" as const,
      notes: [roundNote(1, "#fff", "Peek", 100)],
      notesDemoId: "d1",
      canUndo: true,
      canRedo: false,
      setColor: vi.fn(),
      setPaletteId: vi.fn(),
      setFloorMode: vi.fn(),
      undo,
      redo: vi.fn(),
      commitNotes,
      summaryFilter: DEFAULT_SUMMARY_FILTER,
      setSummaryFilter: vi.fn(),
    },
    view: {
      tool: "pan" as const,
      follow: false,
      trails: true,
      moment: false,
      selected: 0,
      layers: { ...DEFAULT_LAYERS },
      setTool: vi.fn(),
      setFollow: vi.fn(),
      setTrails: vi.fn(),
      setMoment: vi.fn(),
      setLayers: vi.fn(),
      resetView: vi.fn(),
      select: vi.fn(),
      viewEpoch: 0,
    },
    cal: { pos_x: 0, pos_y: 1024, scale: 1, radar: "test.png", lower_radar: "lower.png" },
    habits: {
      aggregated: false,
      overlayOn: true,
      overlay: null,
      overlayDisplay: null,
      overlayTrails: false,
      overlayArrows: false,
      nadeFilter: DEFAULT_HABITS_NADE_FILTER,
      nadesOn: true,
      nadeOpacity: 1,
      playRound: vi.fn(),
      bucketPlaySec: 0,
      bucketPlaySecRef: { current: 0 },
      bucketOverlay: null,
    },
    _actions: { commitNotes, undo },
  };
}

function renderStage() {
  return render(
    <TestRouter>
      <RadarStage />
    </TestRouter>,
  );
}

function twoRoundReplay() {
  return makeReplay({
    rounds: [
      makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      makeRound({ number: 2, start_tick: 640, freeze_end_tick: 704, end_tick: 1280 }),
    ],
  });
}

describe("RadarStage notes vs Aggregated", () => {
  beforeEach(() => {
    canvasProbe.note = null;
    vi.mocked(useApp).mockReset();
  });

  it("clears the prior round's notes on Aggregated and restores them on a live round", () => {
    const noted = radarState(twoRoundReplay());
    vi.mocked(useApp).mockReturnValue(noted as unknown as ReturnType<typeof useApp>);
    const { rerender } = renderStage();
    expect(canvasProbe.note?.drawings).toHaveLength(1);
    expect(canvasProbe.note?.bookmarks).toHaveLength(1);

    const aggregated = radarState(twoRoundReplay());
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

  it("does not paint demo A's notes after Aggregated plus a hop to demo B", () => {
    const replay = twoRoundReplay();
    const notedA = radarState(replay);
    notedA.review.notes = [roundNote(1, "#fff", "A1", 100), roundNote(2, "#f00", "A2", 700)];
    vi.mocked(useApp).mockReturnValue(notedA as unknown as ReturnType<typeof useApp>);
    const { rerender } = renderStage();
    expect(canvasProbe.note?.drawings).toHaveLength(1);

    const aggregated = radarState(replay);
    aggregated.review.notes = notedA.review.notes;
    aggregated.habits.aggregated = true;
    vi.mocked(useApp).mockReturnValue(aggregated as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toEqual([]);

    const hopped = radarState(replay);
    hopped.session.demo = { id: "d2" };
    hopped.review.notes = notedA.review.notes;
    hopped.review.notesDemoId = "d1";
    hopped.playback.tick = 700;
    vi.mocked(useApp).mockReturnValue(hopped as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toEqual([]);
    expect(canvasProbe.note?.bookmarks).toEqual([]);

    hopped.review.notes = [];
    hopped.review.notesDemoId = "d2";
    vi.mocked(useApp).mockReturnValue(hopped as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toEqual([]);
  });

  it("keeps stored notes when draw, clear, bookmark, and undo fire on Aggregated", async () => {
    const state = radarState(
      makeReplay({
        rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      }),
    );
    state.habits.aggregated = true;
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();

    expect(canvasProbe.note?.drawings).toEqual([]);
    expect(screen.getByRole("button", { name: "Draw" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Arrow" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Text note" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Undo drawing (Ctrl+Z)" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear drawings on this round" }));
    await userEvent.click(screen.getByRole("button", { name: /Bookmark this tick/ }));
    expect(state._actions.undo).not.toHaveBeenCalled();
    expect(state._actions.commitNotes).not.toHaveBeenCalled();
    expect(state.view.setTool).not.toHaveBeenCalled();
  });

  it("restores the playhead round's notes after Aggregated, not the round that entered it", () => {
    const round1 = radarState(twoRoundReplay());
    round1.review.notes = [roundNote(1, "#fff", "A", 100), roundNote(2, "#0f0", "B", 700)];
    vi.mocked(useApp).mockReturnValue(round1 as unknown as ReturnType<typeof useApp>);
    const { rerender } = renderStage();
    expect(canvasProbe.note?.bookmarks[0]?.text).toBe("A");

    const aggregated = { ...round1, playback: { ...round1.playback, tick: 700 } };
    aggregated.habits = { ...round1.habits, aggregated: true };
    vi.mocked(useApp).mockReturnValue(aggregated as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toEqual([]);

    const round2 = { ...round1, playback: { ...round1.playback, tick: 700 } };
    vi.mocked(useApp).mockReturnValue(round2 as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.bookmarks[0]?.text).toBe("B");
    expect(canvasProbe.note?.drawings[0]?.color).toBe("#0f0");
  });

  it("keeps notes on a single-demo session even if Aggregated is flagged", () => {
    const state = radarState(
      makeReplay({
        rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      }),
    );
    state.session.series = { mapName: "de_dust2", focalTeam: "Spirit", demos: [{ id: "d1" }] };
    state.habits.aggregated = true;
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    renderStage();
    expect(canvasProbe.note?.drawings).toHaveLength(1);
  });

  it("stays empty across rapid Aggregated toggles", () => {
    const live = radarState(
      makeReplay({
        rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      }),
    );
    const overlay = radarState(live.session.replay);
    overlay.review.notes = live.review.notes;
    overlay.habits.aggregated = true;
    vi.mocked(useApp).mockReturnValue(live as unknown as ReturnType<typeof useApp>);
    const { rerender } = renderStage();
    for (let i = 0; i < 4; i++) {
      vi.mocked(useApp).mockReturnValue(
        (i % 2 === 0 ? overlay : live) as unknown as ReturnType<typeof useApp>,
      );
      rerender(
        <TestRouter>
          <RadarStage />
        </TestRouter>,
      );
    }
    expect(canvasProbe.note?.drawings).toHaveLength(1);
    vi.mocked(useApp).mockReturnValue(overlay as unknown as ReturnType<typeof useApp>);
    rerender(
      <TestRouter>
        <RadarStage />
      </TestRouter>,
    );
    expect(canvasProbe.note?.drawings).toEqual([]);
  });
});
