/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
import { makeReplay } from "@/lib/testing/fixtures";
import { runParsePool } from "./parsePool";
import { loadedDemo } from "./session";
import type { Status } from "@/lib/state/status";
import { useDemoSession } from "./useDemoSession";

vi.mock("./parsePool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./parsePool")>();
  return {
    ...actual,
    runParsePool: vi.fn(),
    parsePoolSize: () => 2,
    parsePoolBar: vi.fn(),
  };
});

const TIMINGS: ParseTimings = { initMs: 1, parseMs: 2, jsonMs: 3, buffersMs: 4, totalMs: 10 };

/**
 * Stands in for the parse worker so the hook can be driven without WASM.
 */
class FakeWorker {
  onmessage: ((ev: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  posted: Promise<void>;
  terminate = vi.fn();
  private resolvePosted!: () => void;

  constructor() {
    this.posted = new Promise((resolve) => {
      this.resolvePosted = resolve;
    });
  }

  postMessage() {
    this.resolvePosted();
    this.posted = new Promise((resolve) => {
      this.resolvePosted = resolve;
    });
  }

  emit(msg: WorkerOut) {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerOut>);
  }

  emitError(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function makeStatus(): Status {
  return {
    error: null,
    notice: null,
    clear: vi.fn(),
    setError: vi.fn(),
    setNotice: vi.fn(),
  };
}

function renderSession(opts?: { onBeforeSelectDemo?: () => void }) {
  const workers: FakeWorker[] = [];
  const status = makeStatus();
  const createWorker = () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const view = renderHook(() =>
    useDemoSession({ status, createWorker, onBeforeSelectDemo: opts?.onBeforeSelectDemo }),
  );
  return { ...view, workers, status };
}

async function parseSingle(
  result: ReturnType<typeof renderSession>["result"],
  workers: FakeWorker[],
  file = new File(["fake"], "match.dem"),
  replay: Replay = makeReplay({ header: { team_ct: "Astralis", team_t: "Vitality" } }),
) {
  act(() => {
    result.current.parseDemo(file);
  });
  await workers[0].posted;
  await act(async () => {
    workers[0].emit({ type: "done", replay, timings: TIMINGS });
  });
  return { file, replay };
}

describe("useDemoSession", () => {
  beforeEach(() => {
    vi.mocked(runParsePool).mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads a single demo on worker done", async () => {
    const { result, workers, status } = renderSession();
    const { file, replay } = await parseSingle(result, workers);

    expect(status.clear).toHaveBeenCalled();
    expect(result.current.parsing).toBe(false);
    expect(result.current.demo).toEqual(loadedDemo(replay, file.name, file));
    expect(result.current.replay).toBe(replay);
    expect(result.current.fileName).toBe("match.dem");
    expect(result.current.series).toBeNull();
    expect(result.current.mapGroups).toEqual([]);
    expect(result.current.parsedDemos).toEqual([]);
    expect(status.setNotice).toHaveBeenCalledWith(
      "Parsed in 10ms (WASM 2ms, JSON 3ms, buffers 4ms)",
    );
  });

  it("reports a parse error from the worker", async () => {
    const { result, workers, status } = renderSession();
    const file = new File(["fake"], "bad.dem");

    act(() => {
      result.current.parseDemo(file);
    });
    await workers[0].posted;
    await act(async () => {
      workers[0].emit({ type: "error", message: "Supports only Source 2 replays" });
    });

    expect(status.setError).toHaveBeenCalledWith("Supports only Source 2 replays");
    expect(result.current.demo).toBeNull();
    expect(result.current.parsing).toBe(false);
  });

  it("reports a worker runtime error", async () => {
    const { result, workers, status } = renderSession();
    const file = new File(["fake"], "crash.dem");

    act(() => {
      result.current.parseDemo(file);
    });
    await workers[0].posted;
    await act(async () => {
      workers[0].emitError("Worker failed");
    });

    expect(status.setError).toHaveBeenCalledWith("Worker failed");
    expect(result.current.demo).toBeNull();
    expect(result.current.parsing).toBe(false);
  });

  it("resets session state on close", async () => {
    const { result, workers } = renderSession();
    await parseSingle(result, workers);

    expect(workers[0].terminate).not.toHaveBeenCalled();

    act(() => {
      result.current.close();
    });

    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(result.current.demo).toBeNull();
    expect(result.current.series).toBeNull();
    expect(result.current.mapGroups).toEqual([]);
    expect(result.current.selectedMapName).toBeNull();
    expect(result.current.parsedDemos).toEqual([]);
    expect(result.current.parsing).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.parseFiles).toBeNull();
    expect(result.current.switching).toBe(false);
    expect(result.current.replay).toBeNull();
    expect(result.current.fileName).toBe("");
  });

  it("reuses the warm worker for a second single-file parse", async () => {
    const { result, workers } = renderSession();
    await parseSingle(result, workers);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminate).not.toHaveBeenCalled();

    const file2 = new File(["fake2"], "second.dem");
    const replay2 = makeReplay({
      header: { team_ct: "NaVi", team_t: "FaZe", map_name: "de_mirage" },
    });
    act(() => {
      result.current.parseDemo(file2);
    });
    await workers[0].posted;
    await act(async () => {
      workers[0].emit({ type: "done", replay: replay2, timings: TIMINGS });
    });

    expect(workers).toHaveLength(1);
    expect(result.current.fileName).toBe("second.dem");
    expect(result.current.demo?.replay).toBe(replay2);
  });

  it("resets the in-flight worker when a new parse starts", async () => {
    const { result, workers } = renderSession();
    const file1 = new File(["a"], "first.dem");
    const file2 = new File(["b"], "second.dem");
    const replay2 = makeReplay({ header: { team_ct: "NaVi", team_t: "FaZe" } });

    act(() => {
      result.current.parseDemo(file1);
    });
    await workers[0].posted;

    act(() => {
      result.current.parseDemo(file2);
    });
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(2);
    await workers[1].posted;
    await act(async () => {
      workers[1].emit({ type: "done", replay: replay2, timings: TIMINGS });
    });

    expect(result.current.fileName).toBe("second.dem");
    expect(result.current.parsing).toBe(false);
  });

  it("parses a multi-file series through the pool", async () => {
    const { result, status } = renderSession();
    const replayA = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const replayB = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const fileA = new File(["a"], "a.dem");
    const fileB = new File(["b"], "b.dem");
    const demoA = loadedDemo(replayA, "a.dem", fileA);
    const demoB = loadedDemo(replayB, "b.dem", fileB);

    vi.mocked(runParsePool).mockResolvedValue([
      { file: fileA, demo: demoA, timings: TIMINGS },
      { file: fileB, demo: demoB, timings: TIMINGS },
    ]);

    await act(async () => {
      await result.current.parseDemos([fileA, fileB]);
    });

    expect(runParsePool).toHaveBeenCalled();
    expect(result.current.parsing).toBe(false);
    expect(result.current.mapGroups).toHaveLength(1);
    expect(result.current.mapGroups[0].mapName).toBe("de_ancient");
    expect(result.current.parsedDemos).toEqual([demoA, demoB]);
    expect(result.current.selectedMapName).toBe("de_ancient");
    expect(result.current.series?.demos).toEqual([demoA, demoB]);
    expect(result.current.demo).toBe(demoA);
    expect(status.setNotice).toHaveBeenCalledWith("Series: 2 de_ancient demos · Spirit");
  });

  it("selects another demo in the active series", async () => {
    const { result } = renderSession();
    const replayA = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const replayB = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const fileA = new File(["a"], "a.dem");
    const fileB = new File(["b"], "b.dem");
    const demoA = loadedDemo(replayA, "a.dem", fileA);
    const demoB = loadedDemo(replayB, "b.dem", fileB);

    vi.mocked(runParsePool).mockResolvedValue([
      { file: fileA, demo: demoA, timings: TIMINGS },
      { file: fileB, demo: demoB, timings: TIMINGS },
    ]);

    await act(async () => {
      await result.current.parseDemos([fileA, fileB]);
    });
    expect(result.current.demo).toBe(demoA);

    act(() => {
      result.current.selectDemo(demoB.id);
    });

    expect(result.current.demo).toBe(demoB);
    expect(result.current.switching).toBe(false);
  });

  it("selects another map group in a multi-map series", async () => {
    const onBeforeSelectDemo = vi.fn();
    const { result } = renderSession({ onBeforeSelectDemo });
    const ancientA = makeReplay({ header: { map_name: "de_ancient", team_ct: "CT", team_t: "T" } });
    const ancientB = makeReplay({ header: { map_name: "de_ancient", team_ct: "CT", team_t: "T" } });
    const mirage = makeReplay({ header: { map_name: "de_mirage", team_ct: "CT", team_t: "T" } });
    const fileAncientA = new File(["a"], "ancient-a.dem");
    const fileAncientB = new File(["b"], "ancient-b.dem");
    const fileMirage = new File(["c"], "mirage.dem");
    const demoAncientA = loadedDemo(ancientA, "ancient-a.dem", fileAncientA);
    const demoAncientB = loadedDemo(ancientB, "ancient-b.dem", fileAncientB);
    const demoMirage = loadedDemo(mirage, "mirage.dem", fileMirage);

    vi.mocked(runParsePool).mockResolvedValue([
      { file: fileAncientA, demo: demoAncientA, timings: TIMINGS },
      { file: fileAncientB, demo: demoAncientB, timings: TIMINGS },
      { file: fileMirage, demo: demoMirage, timings: TIMINGS },
    ]);

    await act(async () => {
      await result.current.parseDemos([fileAncientA, fileAncientB, fileMirage]);
    });
    expect(result.current.selectedMapName).toBe("de_ancient");
    expect(result.current.demo).toBe(demoAncientA);

    act(() => {
      result.current.selectMap("de_mirage");
    });

    expect(onBeforeSelectDemo).toHaveBeenCalled();
    expect(result.current.selectedMapName).toBe("de_mirage");
    expect(result.current.demo).toBe(demoMirage);
    expect(result.current.series?.mapName).toBe("de_mirage");
    expect(result.current.switching).toBe(false);
  });

  it("updates the focal team on an active series", async () => {
    const { result } = renderSession();
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const fileA = new File(["a"], "a.dem");
    const fileB = new File(["b"], "b.dem");
    const demoA = loadedDemo(replay, "a.dem", fileA);
    const demoB = loadedDemo(replay, "b.dem", fileB);

    vi.mocked(runParsePool).mockResolvedValue([
      { file: fileA, demo: demoA, timings: TIMINGS },
      { file: fileB, demo: demoB, timings: TIMINGS },
    ]);

    await act(async () => {
      await result.current.parseDemos([fileA, fileB]);
    });
    expect(result.current.series?.focalTeam).toBe("NaVi");

    act(() => {
      result.current.setFocalTeam("FaZe");
    });

    expect(result.current.series?.focalTeam).toBe("FaZe");
    expect(result.current.series?.focalTeamNames).toContain("FaZe");
  });
});
