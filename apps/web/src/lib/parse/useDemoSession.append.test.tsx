/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
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

function renderSession(opts?: { seriesMaxFiles?: number }) {
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

describe("useDemoSession append", () => {
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

  it("promotes a single demo into a series when another same-map file is appended", async () => {
    const { result, workers, status } = renderSession();
    const firstReplay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const { file: firstFile, replay: firstReplayLoaded } = await parseSingle(
      result,
      workers,
      demoFile("first.dem"),
      firstReplay,
    );
    const first = result.current.demo;
    expect(first).not.toBeNull();
    expect(result.current.series).toBeNull();

    const secondFile = demoFile("second.dem");
    const secondReplay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const second = loadedDemo(secondReplay, "second.dem", secondFile);
    vi.mocked(runParsePool).mockResolvedValue([
      { file: secondFile, demo: second, timings: TIMINGS },
    ]);

    await act(async () => {
      await result.current.appendDemos([secondFile]);
    });

    expect(result.current.demo).toBe(first);
    expect(result.current.demo?.fileName).toBe(firstFile.name);
    expect(result.current.demo?.replay).toBe(firstReplayLoaded);
    expect(result.current.series?.demos).toHaveLength(2);
    expect(result.current.series?.demos.map((row) => row.fileName)).toEqual([
      "first.dem",
      "second.dem",
    ]);
    expect(result.current.parsedDemos).toHaveLength(2);
    expect(result.current.mapGroups).toHaveLength(1);
    expect(result.current.selectedMapName).toBe("de_mirage");
    expect(status.setNotice).toHaveBeenCalledWith("Series: 2 de_mirage demos · NaVi");
  });

  it("folds an appended file into an existing series and keeps the open demo", async () => {
    const { result } = renderSession();
    const replayA = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const replayB = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const replayC = makeReplay({
      header: { map_name: "de_ancient", team_ct: "Spirit", team_t: "G2" },
    });
    const fileA = demoFile("a.dem");
    const fileB = demoFile("b.dem");
    const fileC = demoFile("c.dem");
    const demoA = loadedDemo(replayA, "a.dem", fileA);
    const demoB = loadedDemo(replayB, "b.dem", fileB);
    const demoC = loadedDemo(replayC, "c.dem", fileC);

    vi.mocked(runParsePool).mockResolvedValueOnce([
      { file: fileA, demo: demoA, timings: TIMINGS },
      { file: fileB, demo: demoB, timings: TIMINGS },
    ]);
    await act(async () => {
      await result.current.parseDemos([fileA, fileB]);
    });
    act(() => {
      result.current.selectDemo(demoB.id);
    });
    expect(result.current.demo).toBe(demoB);

    vi.mocked(runParsePool).mockResolvedValueOnce([{ file: fileC, demo: demoC, timings: TIMINGS }]);
    await act(async () => {
      await result.current.appendDemos([fileC]);
    });

    expect(result.current.demo).toBe(demoB);
    expect(result.current.series?.demos).toEqual([demoA, demoB, demoC]);
    expect(result.current.parsedDemos).toEqual([demoA, demoB, demoC]);
  });

  it("adds a different-map append as another group without leaving the current map", async () => {
    const { result, workers } = renderSession();
    const mirageReplay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    await parseSingle(result, workers, demoFile("mirage.dem"), mirageReplay);
    const open = result.current.demo;

    const ancientFile = demoFile("ancient.dem");
    const ancient = loadedDemo(
      makeReplay({ header: { map_name: "de_ancient", team_ct: "NaVi", team_t: "FaZe" } }),
      "ancient.dem",
      ancientFile,
    );
    vi.mocked(runParsePool).mockResolvedValue([
      { file: ancientFile, demo: ancient, timings: TIMINGS },
    ]);

    await act(async () => {
      await result.current.appendDemos([ancientFile]);
    });

    expect(result.current.demo).toBe(open);
    expect(result.current.selectedMapName).toBe("de_mirage");
    expect(result.current.series?.mapName).toBe("de_mirage");
    expect(result.current.series?.demos).toHaveLength(1);
    expect(result.current.mapGroups).toHaveLength(2);
  });

  it("rejects an append that would exceed the series cap without wiping the session", async () => {
    const { result, workers, status } = renderSession({ seriesMaxFiles: 2 });
    await parseSingle(result, workers);
    const open = result.current.demo;

    await act(async () => {
      await result.current.appendDemos([demoFile("b.dem"), demoFile("c.dem")]);
    });

    expect(status.setError).toHaveBeenCalledWith("Series supports at most 2 demos.");
    expect(runParsePool).not.toHaveBeenCalled();
    expect(result.current.demo).toBe(open);
    expect(result.current.series).toBeNull();
  });

  it("rejects a bad append without wiping the loaded demo", async () => {
    const { result, workers, status } = renderSession();
    await parseSingle(result, workers);
    const open = result.current.demo;

    await act(async () => {
      await result.current.appendDemos([new File(["x"], "clip.mp4")]);
    });

    expect(status.setError).toHaveBeenCalledWith(expect.stringContaining("not a .dem file"));
    expect(runParsePool).not.toHaveBeenCalled();
    expect(result.current.demo).toBe(open);
    expect(result.current.parsing).toBe(false);
  });

  it("cancels an in-flight append and keeps the open session", async () => {
    const { result, workers, status } = renderSession();
    await parseSingle(result, workers);
    const open = result.current.demo;
    const extra = demoFile("extra.dem");

    let resolvePool!: (
      value: { file: File; demo?: ReturnType<typeof loadedDemo>; timings?: typeof TIMINGS }[],
    ) => void;
    vi.mocked(runParsePool).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePool = resolve;
        }),
    );

    const finished = result.current.appendDemos([extra]);
    await waitFor(() => expect(runParsePool).toHaveBeenCalled());
    expect(result.current.parsing).toBe(true);
    expect(result.current.demo).toBe(open);

    act(() => {
      result.current.cancelParse();
    });
    expect(result.current.parsing).toBe(false);
    expect(result.current.demo).toBe(open);
    expect(status.setNotice).toHaveBeenCalledWith("Parse cancelled.");

    resolvePool([{ file: extra, timings: TIMINGS }]);
    await act(async () => {
      await finished;
    });

    expect(result.current.demo).toBe(open);
    expect(result.current.series).toBeNull();
    expect(result.current.parseFiles).toBeNull();
  });

  it("notices a duplicate append and leaves the series unchanged", async () => {
    const { result, status } = renderSession();
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NaVi", team_t: "FaZe" },
    });
    const fileA = demoFile("a.dem");
    const fileB = demoFile("b.dem");
    const demoA = loadedDemo(replay, "a.dem", fileA);
    const demoB = loadedDemo(replay, "b.dem", fileB);
    vi.mocked(runParsePool).mockResolvedValueOnce([
      { file: fileA, demo: demoA, timings: TIMINGS },
      { file: fileB, demo: demoB, timings: TIMINGS },
    ]);
    await act(async () => {
      await result.current.parseDemos([fileA, fileB]);
    });

    vi.mocked(runParsePool).mockResolvedValueOnce([{ file: fileA, demo: demoA, timings: TIMINGS }]);
    await act(async () => {
      await result.current.appendDemos([fileA]);
    });

    expect(result.current.series?.demos).toEqual([demoA, demoB]);
    expect(status.setNotice).toHaveBeenCalledWith("a.dem is already in this series.");
  });
});
