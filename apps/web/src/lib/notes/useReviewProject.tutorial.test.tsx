/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { loadedDemo, type DemoSeries } from "@/lib/parse/session";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { TUTORIAL_FILENAME, TUTORIAL_ID, tutorialReplayDemo } from "@/lib/tutorial/identity";
import { tutorialSeriesDemoId } from "@/lib/tutorial/multi-demo/types";
import type { Status } from "@/lib/state/status";
import { emptyNote } from "./note";
import { DEFAULT_SUMMARY_FILTER } from "./types";
import { PROJECT_SCHEMA, type ReviewProject } from "./projectStore";
import { clearSeriesReviewCache } from "./seriesReviewCache";
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

function realDemo(fileName = "match.dem") {
  const replay = makeReplay({
    header: { map_name: "de_mirage", team_ct: "A", team_t: "B" },
    players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
  });
  return loadedDemo(replay, fileName, new File([], fileName));
}

function tutorialDemo() {
  return tutorialReplayDemo(
    makeReplay({
      header: { map_name: "de_mirage", team_ct: "A", team_t: "B" },
      players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
    }),
  );
}

function tutorialSeriesDemo(index: number) {
  const fileName = `tutorial-series-${index}.dem`;
  const replay = makeReplay({
    header: { map_name: "de_dust2", team_ct: "A", team_t: "B" },
    players: [makePlayer(0, "CT", "A", 100), makePlayer(1, "T", "B", 50)],
  });
  const demo = loadedDemo(replay, fileName, new File([], fileName));
  demo.id = tutorialSeriesDemoId({ id: `match-${index}`, mapName: "de_dust2" });
  return demo;
}

function project(partial: Partial<ReviewProject> = {}): ReviewProject {
  return {
    schema: PROJECT_SCHEMA,
    key: "de_mirage|1|50,100|match.dem",
    savedAt: 2,
    fileName: "match.dem",
    mapName: "de_mirage",
    tick: 300,
    notes: [],
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

describe("useReviewProject tutorial isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSeriesReviewCache();
    mocks.loadAllProjects.mockResolvedValue([project()]);
    mocks.loadProject.mockResolvedValue(null);
    mocks.matchKey.mockReturnValue("de_mirage|1|50,100|tutorial.dem");
    mocks.saveProject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps tutorial drawings in memory without writing Saved Notes", async () => {
    const d = tutorialDemo();
    expect(d.id).toBe(TUTORIAL_ID);
    expect(d.fileName).toBe(TUTORIAL_FILENAME);
    const { result } = renderHook(() =>
      useReviewProject({
        demo: d,
        series: null,
        parsedDemos: [],
        status: status(),
        playback: playback(),
      }),
    );

    await waitFor(() => expect(result.current.notesDemoId).toBe(d.id));
    mocks.saveProject.mockClear();
    act(() => {
      result.current.commitNotes([
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
          },
        },
      ]);
    });
    await act(async () => {
      await result.current.persistNow();
    });
    expect(result.current.notes[0]?.note.drawings).toHaveLength(1);
    expect(mocks.saveProject).not.toHaveBeenCalled();
    expect(mocks.loadProject).not.toHaveBeenCalled();
  });

  it("does not seed tutorial series files into Saved Notes", async () => {
    const demos = [tutorialSeriesDemo(0), tutorialSeriesDemo(1)];
    const series: DemoSeries = {
      mapName: "de_dust2",
      demos,
      focalTeam: "A",
      focalTeamNames: ["A"],
      tagsByDemo: new Map(),
    };
    renderHook(() =>
      useReviewProject({
        demo: demos[0],
        series,
        parsedDemos: demos,
        status: status(),
        playback: playback(),
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.saveProject).not.toHaveBeenCalled();
  });

  it("does not persist tutorial drawings on unmount", async () => {
    const first = tutorialSeriesDemo(0);
    const series: DemoSeries = {
      mapName: "de_dust2",
      demos: [first, tutorialSeriesDemo(1)],
      focalTeam: "A",
      focalTeamNames: ["A"],
      tagsByDemo: new Map(),
    };
    const { result, unmount } = renderHook(() =>
      useReviewProject({
        demo: first,
        series,
        parsedDemos: [],
        status: status(),
        playback: playback(),
      }),
    );
    await waitFor(() => expect(result.current.notesDemoId).toBe(first.id));
    act(() => {
      result.current.commitNotes([
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "pen", color: "#fff", points: [{ x: 1, y: 2 }] }],
          },
        },
      ]);
    });
    mocks.saveProject.mockClear();
    unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.saveProject).not.toHaveBeenCalled();
  });

  it("does not autoplay the tutorial fixture so the Play coach-mark can run", async () => {
    const pb = playback();
    const d = tutorialDemo();
    const { result } = renderHook(() =>
      useReviewProject({
        demo: d,
        series: null,
        parsedDemos: [],
        status: status(),
        playback: pb,
      }),
    );
    await waitFor(() => expect(result.current.notesDemoId).toBe(d.id));
    expect(pb.setPlaying).not.toHaveBeenCalled();
    expect(mocks.loadProject).not.toHaveBeenCalled();
  });

  it("still persists a real Analyzer demo", async () => {
    const d = realDemo();
    mocks.matchKey.mockReturnValue("de_mirage|1|50,100|match.dem");
    const { result } = renderHook(() =>
      useReviewProject({
        demo: d,
        series: null,
        parsedDemos: [],
        status: status(),
        playback: playback(),
      }),
    );
    await waitFor(() => expect(mocks.loadProject).toHaveBeenCalled());
    await act(async () => {
      await result.current.persistNow();
    });
    expect(mocks.saveProject).toHaveBeenCalled();
  });
});
