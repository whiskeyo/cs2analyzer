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
import { resetTutorialInstallState, useTutorial } from "./useTutorial";

const loadMocks = vi.hoisted(() => ({
  loadTutorialReplay: vi.fn(),
  loadTutorialSeries: vi.fn(),
  loadTutorialPlaybook: vi.fn(),
}));

const prefetchMocks = vi.hoisted(() => ({
  scheduleHomeTutorialPrefetch: vi.fn(() => () => {}),
  prefetchNextTutorialStep: vi.fn(),
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
}));

vi.mock("./prefetch", () => ({
  scheduleHomeTutorialPrefetch: prefetchMocks.scheduleHomeTutorialPrefetch,
  prefetchNextTutorialStep: prefetchMocks.prefetchNextTutorialStep,
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
    prefetchMocks.scheduleHomeTutorialPrefetch.mockClear();
    prefetchMocks.prefetchNextTutorialStep.mockClear();
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
    vi.clearAllMocks();
  });

  it("installs the single-demo fixture from ?tutorial=1", async () => {
    const { installDemo, status } = mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/analyzer?tutorial=1") });

    await waitFor(() => expect(installDemo).toHaveBeenCalledOnce());
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalledOnce();
    expect(loadMocks.loadTutorialSeries).not.toHaveBeenCalled();
    expect(prefetchMocks.prefetchNextTutorialStep).toHaveBeenCalledWith("replay");
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

  it("installs the Aggregated series from ?tutorial=aggregated", async () => {
    const a = loadedDemo(replay, "a.dem", new File([], "a.dem"));
    const b = loadedDemo(replay, "b.dem", new File([], "b.dem"));
    const series = buildSeries("de_dust2", [a, b]);
    loadMocks.loadTutorialSeries.mockResolvedValue(series);
    const { installSeries, installDemo } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/analyzer?tutorial=aggregated"),
    });

    await waitFor(() => expect(installSeries).toHaveBeenCalledWith(series));
    expect(installDemo).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    expect(prefetchMocks.prefetchNextTutorialStep).toHaveBeenCalledWith("aggregated");
  });

  it("saves the sample playbook from ?tutorial=playbook", async () => {
    const { installDemo, close } = mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/playbook?tutorial=playbook"),
    });
    await waitFor(() => expect(playbookMocks.savePlaybook).toHaveBeenCalledWith(book));
    expect(playbookMocks.emitPlaybooksChanged).toHaveBeenCalledOnce();
    expect(installDemo).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(prefetchMocks.prefetchNextTutorialStep).toHaveBeenCalledWith("playbook");
  });

  it("does not overwrite an existing sample playbook", async () => {
    playbookMocks.loadPlaybook.mockResolvedValue(book);
    mockSession();
    renderHook(() => useTutorial(), {
      wrapper: wrapper("/playbook?tutorial=playbook"),
    });
    await waitFor(() => expect(playbookMocks.loadPlaybook).toHaveBeenCalled());
    expect(playbookMocks.savePlaybook).not.toHaveBeenCalled();
  });

  it("idles a Home Replay prefetch when the tour is not completed", () => {
    mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/") });
    expect(prefetchMocks.scheduleHomeTutorialPrefetch).toHaveBeenCalledOnce();
  });

  it("skips Home Replay prefetch after tutorialCompleted", () => {
    settingsMocks.tutorialCompleted = true;
    mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/") });
    expect(prefetchMocks.scheduleHomeTutorialPrefetch).not.toHaveBeenCalled();
  });

  it("redirects Home ?tutorial=1 onto Analyzer and installs the sample", async () => {
    const { installDemo } = mockSession();
    renderHook(() => useTutorial(), { wrapper: wrapper("/?tutorial=1") });
    await waitFor(() => expect(installDemo).toHaveBeenCalledOnce());
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalledOnce();
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
    expect(prefetchMocks.scheduleHomeTutorialPrefetch).not.toHaveBeenCalled();
  });

  it("does not reload when the open session already matches the query", async () => {
    const demo = tutorialReplayDemo(replay);
    const { installDemo, session } = mockSession();
    session.demo = demo;
    session.replay = replay;
    renderHook(() => useTutorial(), { wrapper: wrapper("/analyzer?tutorial=1") });
    await act(async () => {
      await Promise.resolve();
    });
    expect(installDemo).not.toHaveBeenCalled();
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
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
    installDemo.mockClear();
    status.setNotice.mockClear();
    session.demo = null;
    session.replay = null;
    renderHook(() => useTutorial(), { wrapper: wrapper("/analyzer?tutorial=1") });
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    expect(installDemo).not.toHaveBeenCalled();
    expect(status.setNotice).not.toHaveBeenCalled();
  });
});
