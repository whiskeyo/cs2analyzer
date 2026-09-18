/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadMocks = vi.hoisted(() => ({
  loadTutorialReplay: vi.fn(),
  loadTutorialSeries: vi.fn(),
  loadTutorialPlaybook: vi.fn(),
}));

vi.mock("./load", () => ({
  loadTutorialReplay: loadMocks.loadTutorialReplay,
  loadTutorialSeries: loadMocks.loadTutorialSeries,
  loadTutorialPlaybook: loadMocks.loadTutorialPlaybook,
}));

import {
  prefersSaveData,
  prefetchNextTutorialStep,
  prefetchTutorialReplay,
  scheduleHomeTutorialPrefetch,
  TUTORIAL_HOME_PREFETCH_TIMEOUT_MS,
} from "./prefetch";

describe("tutorial prefetch", () => {
  beforeEach(() => {
    loadMocks.loadTutorialReplay.mockReset().mockResolvedValue({});
    loadMocks.loadTutorialSeries.mockReset().mockResolvedValue({});
    loadMocks.loadTutorialPlaybook.mockReset().mockResolvedValue({});
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("skips Home Replay prefetch when Save-Data is on", () => {
    vi.stubGlobal("navigator", { connection: { saveData: true } });
    expect(prefersSaveData()).toBe(true);
    const cancel = scheduleHomeTutorialPrefetch();
    cancel();
    prefetchTutorialReplay();
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
  });

  it("does not fetch the Replay chunk until idle (or the short timeout)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { connection: { saveData: false } });
    const cancel = scheduleHomeTutorialPrefetch();
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TUTORIAL_HOME_PREFETCH_TIMEOUT_MS);
    expect(loadMocks.loadTutorialReplay).toHaveBeenCalledOnce();
    expect(loadMocks.loadTutorialSeries).not.toHaveBeenCalled();
    cancel();
    vi.useRealTimers();
  });

  it("cancels a pending Home prefetch when leaving the page", () => {
    vi.useFakeTimers();
    const cancel = scheduleHomeTutorialPrefetch();
    cancel();
    vi.advanceTimersByTime(TUTORIAL_HOME_PREFETCH_TIMEOUT_MS);
    expect(loadMocks.loadTutorialReplay).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("warms multi-demo on Replay and the playbook sample on Aggregated", () => {
    prefetchNextTutorialStep("replay");
    expect(loadMocks.loadTutorialSeries).toHaveBeenCalledOnce();
    expect(loadMocks.loadTutorialPlaybook).not.toHaveBeenCalled();
    prefetchNextTutorialStep("aggregated");
    expect(loadMocks.loadTutorialPlaybook).toHaveBeenCalledOnce();
    prefetchNextTutorialStep("playbook");
    expect(loadMocks.loadTutorialSeries).toHaveBeenCalledOnce();
    expect(loadMocks.loadTutorialPlaybook).toHaveBeenCalledOnce();
  });
});
