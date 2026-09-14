/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
import { seriesRamWarning } from "@/lib/shared/constants";
import { makeReplay } from "@/lib/testing/fixtures";
import { runParsePool } from "./parsePool";
import { CS2_DEMO_MAGIC } from "./demoFile";
import { loadedDemo } from "./session";
import type { Status } from "@/lib/state/status";
import { useDemoSession } from "./useDemoSession";

const parserMocks = vi.hoisted(() => ({
  ensureParser: vi.fn(),
  parserFactory: vi.fn((): (() => Worker) | null => null),
  prefetchParser: vi.fn(),
  discardParserWarmup: vi.fn(),
}));

vi.mock("./parsePool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./parsePool")>();
  return {
    ...actual,
    runParsePool: vi.fn(),
    parsePoolSize: () => 2,
    parsePoolBar: vi.fn(),
  };
});

vi.mock("./ensureParser", () => ({
  ensureParser: parserMocks.ensureParser,
  parserFactory: parserMocks.parserFactory,
  prefetchParser: parserMocks.prefetchParser,
  discardParserWarmup: parserMocks.discardParserWarmup,
}));

const TIMINGS: ParseTimings = {
  initMs: 1,
  parseMs: 2,
  jsonMs: 3,
  buffersMs: 4,
  totalMs: 10,
};

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

function demoFile(name: string, extra = "body"): File {
  return new File([`${CS2_DEMO_MAGIC}${extra}`], name);
}

function renderSession(opts?: { onBeforeSelectDemo?: () => void; seriesMaxFiles?: number }) {
  const workers: FakeWorker[] = [];
  const status = makeStatus();
  const createWorker = () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const view = renderHook(() =>
    useDemoSession({
      status,
      createWorker,
      onBeforeSelectDemo: opts?.onBeforeSelectDemo,
      seriesMaxFiles: opts?.seriesMaxFiles,
    }),
  );
  return { ...view, workers, status };
}

async function parseSingle(
  result: ReturnType<typeof renderSession>["result"],
  workers: FakeWorker[],
  file = demoFile("match.dem"),
  replay: Replay = makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
  }),
) {
  await act(async () => {
    await result.current.parseDemo(file);
  });
  await act(async () => {
    workers[0].emit({ type: "done", replay, timings: TIMINGS });
  });
  return { file, replay };
}

describe("useDemoSession", () => {
  beforeEach(() => {
    vi.mocked(runParsePool).mockReset();
    parserMocks.ensureParser.mockReset();
    parserMocks.parserFactory.mockReset();
    parserMocks.parserFactory.mockReturnValue(null);
    parserMocks.discardParserWarmup.mockReset();
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
    const file = demoFile("bad.dem");

    await act(async () => {
      await result.current.parseDemo(file);
    });
    await act(async () => {
      workers[0].emit({
        type: "error",
        message: "Supports only Source 2 replays",
      });
    });

    expect(status.setError).toHaveBeenCalledWith(
      '"bad.dem" is not a Counter-Strike 2 demo. Drop a GOTV .dem from FACEIT, Premier, or matchmaking.',
    );
    expect(result.current.demo).toBeNull();
    expect(result.current.parsing).toBe(false);
  });

  it("rejects a drop that is not a usable GOTV demo before parsing", async () => {
    const { result, workers, status } = renderSession();

    act(() => {
      result.current.parseDemo(new File(["x"], "clip.mp4"));
    });
    expect(status.setError).toHaveBeenCalledWith(expect.stringContaining("not a .dem file"));
    expect(workers).toHaveLength(0);

    await act(async () => {
      result.current.parseDemo(new File(["x"], "match.dem.gz"));
    });
    expect(status.setError).toHaveBeenCalledWith(expect.stringContaining("unsupported gzip"));

    await act(async () => {
      result.current.parseDemo(new File([], "empty.dem"));
    });
    expect(status.setError).toHaveBeenCalledWith(expect.stringContaining("empty"));

    await act(async () => {
      result.current.parseDemo(demoFile("player_pov.dem"));
    });
    expect(status.setError).toHaveBeenCalledWith(expect.stringContaining("POV demo"));
    expect(result.current.parsing).toBe(false);
  });

  it("reports a worker runtime error", async () => {
    const { result, workers, status } = renderSession();
    const file = demoFile("crash.dem");

    await act(async () => {
      await result.current.parseDemo(file);
    });
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
    expect(parserMocks.discardParserWarmup).toHaveBeenCalled();
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

  it("cancels an in-flight single-file parse without leaving a demo", async () => {
    const { result, workers, status } = renderSession();
    const file = demoFile("match.dem");
    await act(async () => {
      await result.current.parseDemo(file);
    });
    expect(result.current.parsing).toBe(true);
    expect(result.current.parseFiles?.[0]).toMatchObject({ name: "match.dem", state: "parsing" });

    act(() => {
      result.current.cancelParse();
    });

    expect(result.current.parsing).toBe(false);
    expect(result.current.demo).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.parseFiles).toBeNull();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(status.setNotice).toHaveBeenCalledWith("Parse cancelled.");

    await act(async () => {
      workers[0].emit({ type: "done", replay: makeReplay(), timings: TIMINGS });
    });
    expect(result.current.demo).toBeNull();
    expect(result.current.parsing).toBe(false);
  });

  it("does nothing when cancelParse is called while idle", () => {
    const { result, status } = renderSession();
    act(() => {
      result.current.cancelParse();
    });
    expect(status.setNotice).not.toHaveBeenCalled();
    expect(result.current.parsing).toBe(false);
  });

  it("cancels a series parse without leaving a partial series", async () => {
    const { result, status } = renderSession();
    const fileA = demoFile("a.dem");
    const fileB = demoFile("b.dem");
    const replayA = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const demoA = loadedDemo(replayA, "a.dem", fileA);

    let resolvePool!: (
      value: { file: File; demo?: ReturnType<typeof loadedDemo>; timings?: typeof TIMINGS }[],
    ) => void;
    vi.mocked(runParsePool).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePool = resolve;
        }),
    );

    const finished = result.current.parseDemos([fileA, fileB]);
    await waitFor(() => expect(runParsePool).toHaveBeenCalled());
    expect(result.current.parsing).toBe(true);

    act(() => {
      result.current.cancelParse();
    });
    expect(result.current.parsing).toBe(false);
    expect(status.setNotice).toHaveBeenCalledWith("Parse cancelled.");

    resolvePool([{ file: fileA, demo: demoA, timings: TIMINGS }]);
    await act(async () => {
      await finished;
    });

    expect(result.current.demo).toBeNull();
    expect(result.current.series).toBeNull();
    expect(result.current.mapGroups).toEqual([]);
    expect(result.current.parsedDemos).toEqual([]);
    expect(result.current.parseFiles).toBeNull();
  });

  it("reuses the warm worker for a second single-file parse", async () => {
    const { result, workers } = renderSession();
    await parseSingle(result, workers);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminate).not.toHaveBeenCalled();

    const file2 = demoFile("second.dem");
    const replay2 = makeReplay({
      header: { team_ct: "NaVi", team_t: "FaZe", map_name: "de_mirage" },
    });
    await act(async () => {
      await result.current.parseDemo(file2);
    });
    await act(async () => {
      workers[0].emit({ type: "done", replay: replay2, timings: TIMINGS });
    });

    expect(workers).toHaveLength(1);
    expect(result.current.fileName).toBe("second.dem");
    expect(result.current.demo?.replay).toBe(replay2);
  });

  it("resets the in-flight worker when a new parse starts", async () => {
    const { result, workers } = renderSession();
    const file1 = demoFile("first.dem");
    const file2 = demoFile("second.dem");
    const replay2 = makeReplay({ header: { team_ct: "NaVi", team_t: "FaZe" } });

    await act(async () => {
      await result.current.parseDemo(file1);
    });
    expect(workers[0]).toBeDefined();

    const second = result.current.parseDemo(file2);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    await act(async () => {
      await second;
    });
    expect(workers[1]).toBeDefined();
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
    const fileA = demoFile("a.dem");
    const fileB = demoFile("b.dem");
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

  it("rejects a multi-drop when every file fails inspection", async () => {
    const { result, status } = renderSession();
    const files = [new File(["x"], "clip.mp4"), new File(["x"], "notes.txt")];

    await act(async () => {
      await result.current.parseDemos(files);
    });

    expect(status.setError).toHaveBeenCalledWith(expect.stringContaining("not a .dem file"));
    expect(runParsePool).not.toHaveBeenCalled();
    expect(result.current.parsing).toBe(false);
  });

  it("parses valid files in a mixed drop and skips junk", async () => {
    const { result } = renderSession();
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const good = demoFile("a.dem");
    const demoA = loadedDemo(replay, "a.dem", good);
    vi.mocked(runParsePool).mockResolvedValue([{ file: good, demo: demoA, timings: TIMINGS }]);

    await act(async () => {
      await result.current.parseDemos([new File(["x"], "clip.mp4"), good]);
    });

    expect(runParsePool).toHaveBeenCalled();
    const passed = vi.mocked(runParsePool).mock.calls[0][1];
    expect(passed).toEqual([good]);
    expect(result.current.demo).toBe(demoA);
  });

  it("rejects a multi-drop above the settings series cap", async () => {
    const { result, status } = renderSession({ seriesMaxFiles: 2 });
    const files = [demoFile("a.dem"), demoFile("b.dem"), demoFile("c.dem")];

    await act(async () => {
      await result.current.parseDemos(files);
    });

    expect(status.setError).toHaveBeenCalledWith("Series supports at most 2 demos.");
    expect(runParsePool).not.toHaveBeenCalled();
    expect(result.current.parsing).toBe(false);
    expect(result.current.demo).toBeNull();
  });

  it("warns that a large series drop uses a lot of RAM", async () => {
    const { result, status } = renderSession({ seriesMaxFiles: 24 });
    const replay = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const files = Array.from({ length: 13 }, (_, i) => demoFile(`${i}.dem`));
    const demos = files.map((file) => loadedDemo(replay, file.name, file));
    vi.mocked(runParsePool).mockResolvedValue(
      files.map((file, i) => ({ file, demo: demos[i], timings: TIMINGS })),
    );

    await act(async () => {
      await result.current.parseDemos(files);
    });

    expect(status.setNotice).toHaveBeenCalledWith(seriesRamWarning());
    expect(status.setNotice).toHaveBeenCalledWith(expect.stringContaining(seriesRamWarning()));
    expect(result.current.series?.demos).toHaveLength(13);
  });

  it("selects another demo in the active series", async () => {
    const { result } = renderSession();
    const replayA = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const replayB = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const fileA = demoFile("a.dem");
    const fileB = demoFile("b.dem");
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
    const ancientA = makeReplay({
      header: { map_name: "de_ancient", team_ct: "CT", team_t: "T" },
    });
    const ancientB = makeReplay({
      header: { map_name: "de_ancient", team_ct: "CT", team_t: "T" },
    });
    const mirage = makeReplay({
      header: { map_name: "de_mirage", team_ct: "CT", team_t: "T" },
    });
    const fileAncientA = demoFile("ancient-a.dem");
    const fileAncientB = demoFile("ancient-b.dem");
    const fileMirage = demoFile("mirage.dem");
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
    const fileA = demoFile("a.dem");
    const fileB = demoFile("b.dem");
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

  it("uses a prefetched parser factory when no worker is injected", async () => {
    const workers: FakeWorker[] = [];
    parserMocks.parserFactory.mockReturnValue(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const status = makeStatus();
    const { result } = renderHook(() => useDemoSession({ status }));
    await parseSingle(result, workers);

    expect(parserMocks.ensureParser).not.toHaveBeenCalled();
    expect(result.current.fileName).toBe("match.dem");
    expect(result.current.parsing).toBe(false);
  });

  it("reports a bootstrap error when the lazy parser fails to load", async () => {
    parserMocks.ensureParser.mockRejectedValue(new Error("failed to fetch Wasm"));
    const status = makeStatus();
    const { result } = renderHook(() => useDemoSession({ status }));

    await act(async () => {
      await result.current.parseDemo(demoFile("match.dem"));
    });
    expect(status.setError).toHaveBeenCalledWith("failed to fetch Wasm");
    expect(result.current.parsing).toBe(false);
  });
});
