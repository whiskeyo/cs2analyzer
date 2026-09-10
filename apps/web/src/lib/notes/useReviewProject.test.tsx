import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { loadedDemo, type DemoSeries } from "@/lib/parse/session";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import type { Status } from "@/lib/state/status";
import { DEFAULT_SUMMARY_FILTER } from "./types";
import type { ReviewProject } from "./projectStore";
import { clearSeriesReviewCache, getSeriesReview } from "./seriesReviewCache";
import { useReviewProject } from "./useReviewProject";

const mocks = vi.hoisted(() => ({
  loadAllProjects: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  matchKey: vi.fn(),
  exportSavedNotes: vi.fn(),
  importNotesFromText: vi.fn(),
  removeAllSavedNotes: vi.fn(),
  tryOpenLinkedDemo: vi.fn(),
  linkDemoFile: vi.fn(),
}));

vi.mock("./projectStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./projectStore")>();
  return {
    ...actual,
    loadAllProjects: mocks.loadAllProjects,
    loadProject: mocks.loadProject,
    saveProject: mocks.saveProject,
    matchKey: mocks.matchKey,
  };
});

vi.mock("./reviewImportExport", () => ({
  exportSavedNotes: mocks.exportSavedNotes,
  importNotesFromText: mocks.importNotesFromText,
  removeAllSavedNotes: mocks.removeAllSavedNotes,
  tryOpenLinkedDemo: mocks.tryOpenLinkedDemo,
  linkDemoFile: mocks.linkDemoFile,
}));

function demo(fileName = "match.dem") {
  const replay = makeReplay({
    header: { map_name: "de_mirage", team_ct: "A", team_t: "B" },
    players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
  });
  return loadedDemo(replay, fileName, new File([], fileName));
}

function project(partial: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: 2,
    key: "de_mirage|1|50,100|match.dem",
    savedAt: 2,
    fileName: "match.dem",
    mapName: "de_mirage",
    tick: 300,
    notes: [],
    strokes: [{ type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] }],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: "default",
    color: "#ff1744",
    ...partial,
  };
}

function playback() {
  const tickRef = { current: 0 };
  return {
    tick: 0,
    tickRef,
    playing: false,
    setPlaying: vi.fn(),
    togglePlaying: vi.fn(),
    activeRound: null,
    jump: vi.fn((t: number) => {
      tickRef.current = t;
    }),
    scrub: vi.fn(),
    pauseNow: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    roundAutoplay: false,
    setRoundAutoplay: vi.fn(),
    playingRef: { current: false },
  };
}

function status(): Status {
  const s = { notice: null as string | null, error: null as string | null };
  return {
    get notice() {
      return s.notice;
    },
    get error() {
      return s.error;
    },
    setNotice: (message: string | null | ((prev: string | null) => string | null)) => {
      s.notice = typeof message === "function" ? message(s.notice) : message;
    },
    setError: vi.fn((message: string | null) => {
      s.error = message;
    }),
    clear: vi.fn(() => {
      s.notice = null;
      s.error = null;
    }),
  } as unknown as Status;
}

describe("useReviewProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSeriesReviewCache();
    mocks.loadAllProjects.mockResolvedValue([project({ savedAt: 10 })]);
    mocks.loadProject.mockResolvedValue(null);
    mocks.matchKey.mockReturnValue("de_mirage|1|50,100|match.dem");
    mocks.exportSavedNotes.mockResolvedValue(undefined);
    mocks.removeAllSavedNotes.mockResolvedValue(undefined);
    mocks.importNotesFromText.mockResolvedValue(undefined);
    mocks.tryOpenLinkedDemo.mockResolvedValue(false);
    mocks.linkDemoFile.mockResolvedValue(undefined);
    mocks.saveProject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the saved-project list on mount", async () => {
    const { result } = renderHook(() =>
      useReviewProject({
        demo: null,
        series: null,
        parsedDemos: [],
        status: status(),
        playback: playback(),
      }),
    );

    await waitFor(() => expect(result.current.saved).toHaveLength(1));
    expect(mocks.loadAllProjects).toHaveBeenCalled();
    expect(result.current.saved[0]?.key).toBe("de_mirage|1|50,100|match.dem");
  });

  it("restores a saved project when a demo loads", async () => {
    const pb = playback();
    const st = status();
    mocks.loadProject.mockResolvedValue(project());

    const { result } = renderHook(() =>
      useReviewProject({
        demo: demo(),
        series: null,
        parsedDemos: [],
        status: st,
        playback: pb,
      }),
    );

    await waitFor(() => expect(result.current.strokes).toHaveLength(1));
    expect(pb.jump).toHaveBeenCalledWith(300, true);
    expect(pb.setPlaying).toHaveBeenCalledWith(false);
    expect(st.notice).toContain("Restored drawings");
    expect(result.current.strokes[0]?.type).toBe("pen");
  });

  it("delegates export and bulk delete to reviewImportExport", async () => {
    const st = status();
    const { result } = renderHook(() =>
      useReviewProject({
        demo: null,
        series: null,
        parsedDemos: [],
        status: st,
        playback: playback(),
      }),
    );

    await act(async () => {
      await result.current.exportNotes();
      await result.current.removeAllNotes();
    });

    expect(mocks.exportSavedNotes).toHaveBeenCalledWith(mocks.loadAllProjects, st);
    expect(mocks.removeAllSavedNotes).toHaveBeenCalledWith(expect.any(Function), st);
  });

  it("applies an imported project through applyProject", async () => {
    const pb = playback();
    const { result } = renderHook(() =>
      useReviewProject({
        demo: demo(),
        series: null,
        parsedDemos: [],
        status: status(),
        playback: pb,
      }),
    );

    await waitFor(() => expect(mocks.loadProject).toHaveBeenCalled());

    act(() => result.current.applyProject(project({ tick: 500, color: "#00ff00" }), true));

    expect(result.current.color).toBe("#00ff00");
    expect(pb.jump).toHaveBeenCalledWith(500, true);
  });

  it("stashes drawings on a series hop mid-debounce without persisting the outgoing demo", async () => {
    const first = demo("a.dem");
    const second = demo("b.dem");
    const series: DemoSeries = {
      mapName: "de_mirage",
      demos: [first, second],
      focalTeam: "A",
      focalTeamNames: ["A"],
      tagsByDemo: new Map(),
    };
    const pb = playback();
    const { result, rerender } = renderHook(
      ({ current }) =>
        useReviewProject({
          demo: current,
          series,
          parsedDemos: [],
          status: status(),
          playback: pb,
        }),
      { initialProps: { current: first } },
    );

    await waitFor(() => expect(pb.setPlaying).toHaveBeenCalledWith(true));

    const stroke = { type: "pen" as const, round: 1, color: "#fff", points: [{ x: 1, y: 2 }] };
    act(() => {
      result.current.commitStrokes([stroke]);
    });
    mocks.saveProject.mockClear();

    act(() => {
      result.current.stashForSeriesSwitch();
    });
    rerender({ current: second });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.saveProject).not.toHaveBeenCalled();
    expect(getSeriesReview(first.id)?.strokes).toEqual([stroke]);
    expect(PROJECT_SAVE_DEBOUNCE_MS).toBeGreaterThan(0);

    act(() => {
      result.current.stashForSeriesSwitch();
    });
    rerender({ current: first });

    await waitFor(() => expect(result.current.strokes).toEqual([stroke]));
  });
});
