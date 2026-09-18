/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeReplay } from "@/lib/testing/fixtures";
import { TUTORIAL_FILENAME, TUTORIAL_ID, tutorialReplayDemo } from "./identity";
import { TUTORIAL_PLAYBOOK_KEY } from "./playbook/constants";
import { TUTORIAL_HOME_PREFETCH_TIMEOUT_MS } from "./prefetch";
import { resetTutorialInstallState, useTutorial } from "./useTutorial";

const loadMocks = vi.hoisted(() => ({
  loadTutorialReplay: vi.fn(),
  loadTutorialSeries: vi.fn(),
  loadTutorialPlaybook: vi.fn(),
  isTutorialSeriesReady: vi.fn(() => false),
}));

const playbookMocks = vi.hoisted(() => ({
  loadPlaybook: vi.fn(),
  savePlaybook: vi.fn(),
  emitPlaybooksChanged: vi.fn(),
}));

const settingsMocks = vi.hoisted(() => ({
  tutorialCompleted: false,
  ready: true,
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useOptionalAnalyzer: vi.fn(),
}));

vi.mock("./load", () => ({
  loadTutorialReplay: loadMocks.loadTutorialReplay,
  loadTutorialSeries: loadMocks.loadTutorialSeries,
  loadTutorialPlaybook: loadMocks.loadTutorialPlaybook,
  isTutorialSeriesReady: loadMocks.isTutorialSeriesReady,
}));

vi.mock("@/lib/playbook/playbookStore", () => ({
  loadPlaybook: playbookMocks.loadPlaybook,
  savePlaybook: playbookMocks.savePlaybook,
}));

vi.mock("@/lib/playbook/events", () => ({
  emitPlaybooksChanged: playbookMocks.emitPlaybooksChanged,
}));

vi.mock("@/lib/settings/useUserSettings", () => ({
  useUserSettings: () => ({
    settings: { tutorialCompleted: settingsMocks.tutorialCompleted },
    ready: settingsMocks.ready,
    saveError: null,
    update: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/lib/state/sessionState", () => ({
  useSession: sessionMocks.useSession,
}));

vi.mock("@/lib/state/analyzerState", () => ({
  useOptionalAnalyzer: sessionMocks.useOptionalAnalyzer,
}));

function wrapper(path: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };
}

function mockSession() {
  const installDemo = vi.fn();
  const installSeries = vi.fn();
  const close = vi.fn();
  const status = {
    error: null,
    notice: null,
    clear: vi.fn(),
    setError: vi.fn(),
    setNotice: vi.fn(),
  };
  const session = {
    demo: null as ReturnType<typeof loadedDemo> | null,
    replay: null as ReturnType<typeof makeReplay> | null,
    series: null as ReturnType<typeof buildSeries> | null,
    installDemo,
    installSeries,
    close,
  };
  sessionMocks.useSession.mockImplementation(() => ({ session, status }));
  sessionMocks.useOptionalAnalyzer.mockReturnValue(null);
  return { session, status, installDemo, installSeries, close };
}

describe("useTutorial", () => {
  const replay = makeReplay({ header: { map_name: "de_mirage" } });
  const book = { key: TUTORIAL_PLAYBOOK_KEY, title: "Tutorial" };

  beforeEach(() => {
    resetTutorialInstallState();
    settingsMocks.tutorialCompleted = false;
    settingsMocks.ready = true;
    loadMocks.loadTutorialReplay.mockReset();
    loadMocks.loadTutorialSeries.mockReset();
    loadMocks.loadTutorialPlaybook.mockReset();
    loadMocks.isTutorialSeriesReady.mockReset().mockReturnValue(false);
    playbookMocks.loadPlaybook.mockReset();
    playbookMocks.savePlaybook.mockReset();
    playbookMocks.emitPlaybooksChanged.mockReset();
    sessionMocks.useSession.mockReset();
    sessionMocks.useOptionalAnalyzer.mockReset();
    loadMocks.loadTutorialReplay.mockResolvedValue(replay);
    loadMocks.loadTutorialSeries.mockResolvedValue(null);
    loadMocks.loadTutorialPlaybook.mockResolvedValue(book);
    playbookMocks.loadPlaybook.mockResolvedValue(null);
    playbookMocks.savePlaybook.mockResolvedValue(book);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("installs the single-demo fixture from ?tutorial=1", async () => {
    const { installDemo, status } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=1"),
    });

    await waitFor(() => expect(installDemo).toHaveBeenCalledOnce());
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalled();
    expect(loadMocks.loadTutorialSeries).toHaveBeenCalled();
    expect(status.setNotice).toHaveBeenCalledWith("Loading tutorial…");
    expect(installDemo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TUTORIAL_ID,
        fileName: TUTORIAL_FILENAME,
        replay,
      }),
    );
    expect(status.clear).toHaveBeenCalled();
  });

  it("starts series prefetch immediately while Replay is still hydrating", async () => {
    let resolveReplay!: (value: typeof replay) => void;
    loadMocks.loadTutorialReplay.mockReturnValue(
      new Promise((resolve) => {
        resolveReplay = resolve;
      }),
    );
    const { installDemo, status } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=1"),
    });

    await waitFor(() => expect(loadMocks.loadTutorialSeries).toHaveBeenCalled());
    expect(installDemo).not.toHaveBeenCalled();
    expect(status.setNotice).toHaveBeenCalledWith("Loading tutorial…");

    await act(async () => {
      resolveReplay(replay);
    });
    await waitFor(() => expect(installDemo).toHaveBeenCalledOnce());
  });

  it("installs the Aggregated series from ?tutorial=aggregated", async () => {
    const a = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const b = loadedDemo(replay, "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_dust2", [a, b]);
    loadMocks.loadTutorialSeries.mockResolvedValue(series);
    const { installSeries, installDemo, status } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=aggregated"),
    });

    await waitFor(() => expect(installSeries).toHaveBeenCalledWith(series));
    expect(installDemo).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalled();
    expect(status.setNotice).toHaveBeenCalledWith("Loading Aggregated series…");
    expect(loadMocks.loadTutorialPlaybook).toHaveBeenCalled();
  });

  it("skips Aggregated loading chrome when the series promise is already ready", async () => {
    const a = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const b = loadedDemo(replay, "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_dust2", [a, b]);
    loadMocks.loadTutorialSeries.mockResolvedValue(series);
    loadMocks.isTutorialSeriesReady.mockReturnValue(true);
    const { installSeries, status } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=aggregated"),
    });

    await waitFor(() => expect(installSeries).toHaveBeenCalledWith(series));
    expect(status.setNotice).not.toHaveBeenCalledWith("Loading Aggregated series…");
  });

  it("opens Aggregated view on the full-buy overlay", async () => {
    const a = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const b = loadedDemo(replay, "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_dust2", [a, b]);
    loadMocks.loadTutorialSeries.mockResolvedValue(series);
    const { installSeries, session } = mockSession();
    const setSeriesView = vi.fn();
    const ensureBucketOverlay = vi.fn();
    sessionMocks.useOptionalAnalyzer.mockReturnValue({
      habits: { aggregated: false, setSeriesView, ensureBucketOverlay },
    });
    const { rerender } = renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=aggregated"),
    });
    await waitFor(() => expect(installSeries).toHaveBeenCalledWith(series));
    session.series = series;
    session.demo = series.demos[0];
    session.replay = series.demos[0].replay;
    rerender();
    await waitFor(() => {
      expect(setSeriesView).toHaveBeenCalledWith("aggregated");
      expect(ensureBucketOverlay).toHaveBeenCalledWith("full", "CT");
    });
  });

  it("loads the sample playbook in-memory from ?tutorial=playbook", async () => {
    const { installDemo, close } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/playbook?tutorial=playbook"),
    });
    await waitFor(() => expect(loadMocks.loadTutorialPlaybook).toHaveBeenCalled());
    expect(installDemo).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("does not write the sample playbook into IndexedDB", async () => {
    mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/playbook?tutorial=playbook"),
    });
    await waitFor(() => expect(loadMocks.loadTutorialPlaybook).toHaveBeenCalled());
    expect(playbookMocks.savePlaybook).not.toHaveBeenCalled();
    expect(playbookMocks.loadPlaybook).not.toHaveBeenCalled();
  });

  it("idles a Home Replay prefetch when the tour is not completed", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/") });
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialSeries).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(TUTORIAL_HOME_PREFETCH_TIMEOUT_MS);
    });
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalledOnce();
    expect(loadMocks.loadTutorialSeries).not.toHaveBeenCalled();
  });

  it("skips Home Replay prefetch after tutorialCompleted", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    settingsMocks.tutorialCompleted = true;
    mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/") });
    act(() => {
      vi.advanceTimersByTime(TUTORIAL_HOME_PREFETCH_TIMEOUT_MS);
    });
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialSeries).not.toHaveBeenCalled();
  });

  it("redirects Home ?tutorial=1 onto Analyzer and installs the sample", async () => {
    const { installDemo } = mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/?tutorial=1") });
    await waitFor(() => expect(installDemo).toHaveBeenCalledOnce());
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalled();
    expect(loadMocks.loadTutorialSeries).toHaveBeenCalled();
  });

  it("ignores a tutorial query on FAQ", async () => {
    const { installDemo } = mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/faq?tutorial=1") });
    await act(async () => {
      await Promise.resolve();
    });
    expect(installDemo).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
  });

  it("does nothing without a tutorial query", async () => {
    const { installDemo } = mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/analyzer") });
    await act(async () => {
      await Promise.resolve();
    });
    expect(installDemo).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialSeries).not.toHaveBeenCalled();
  });

  it("does not reload when the open session already matches the query", async () => {
    const demo = tutorialReplayDemo(replay);
    const { installDemo, session } = mockSession();
    session.demo = demo;
    session.replay = replay;
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=1"),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(installDemo).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalled();
    expect(loadMocks.loadTutorialSeries).toHaveBeenCalled();
  });

  it("does not reload after the session is closed with the query still present", async () => {
    const { installDemo, session, status } = mockSession();
    const { unmount } = renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=1"),
    });
    await waitFor(() => expect(installDemo).toHaveBeenCalledOnce());
    session.demo = tutorialReplayDemo(replay);
    session.replay = replay;
    unmount();

    loadMocks.loadTutorialReplay.mockClear();
    loadMocks.loadTutorialSeries.mockClear();
    installDemo.mockClear();
    status.setNotice.mockClear();
    session.demo = null;
    session.replay = null;
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=1"),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(installDemo).not.toHaveBeenCalled();
    expect(status.setNotice).not.toHaveBeenCalled();
  });
});
