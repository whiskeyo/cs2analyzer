import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchHeader } from "@/lib/replay/replayTypes";

const header: MatchHeader = {
  map_name: "de_mirage",
  tick_rate: 64,
  tick_stride: 4,
  duration_s: 10,
  playback_ticks: 1920,
  team_ct: "CT",
  team_t: "T",
  score_ct: 0,
  score_t: 0,
};

const wasmMocks = vi.hoisted(() => {
  const free = vi.fn();
  let progressReporter: ((current: number, total: number) => void) | undefined;
  const parseDemo = vi.fn(
    (
      _data: Uint8Array,
      _stride: number,
      _withProgress: boolean,
      onProgress?: (current: number, total: number) => void,
    ) => {
      progressReporter = onProgress;
      onProgress?.(1, 4);
      return {
        headerJson: () => JSON.stringify(header),
        playersJson: () => "[]",
        roundsJson: () => "[]",
        grenadesJson: () => "[]",
        shotsJson: () => "[]",
        killsJson: () => "[]",
        hurtsJson: () => "[]",
        blindsJson: () => "[]",
        bombEventsJson: () => "[]",
        buyEventsJson: () => "[]",
        controllerDumpJson: () => "[]",
        frameCount: () => 0,
        playerCount: () => 0,
        ticks: () => new Uint32Array(0),
        x: () => new Float32Array(0),
        y: () => new Float32Array(0),
        z: () => new Float32Array(0),
        yaw: () => new Float32Array(0),
        health: () => new Uint8Array(0),
        armor: () => new Uint8Array(0),
        flags: () => new Uint8Array(0),
        money: () => new Uint16Array(0),
        equip: () => new Uint16Array(0),
        gear: () => new Uint16Array(0),
        primary: () => new Uint8Array(0),
        secondary: () => new Uint8Array(0),
        active: () => new Uint8Array(0),
        clip: () => new Uint8Array(0),
        reserve: () => new Uint16Array(0),
        free,
      };
    },
  );
  return {
    init: vi.fn().mockResolvedValue(undefined),
    parseDemo,
    free,
    getProgressReporter: () => progressReporter,
  };
});

vi.mock("@/parser/cs2analyzer_wasm.js", () => ({
  default: wasmMocks.init,
  parseDemo: wasmMocks.parseDemo,
}));

type ParseWorkerIn = { bytes: ArrayBuffer } | { type: "warmup" };

type WorkerSelf = {
  postMessage: ReturnType<typeof vi.fn>;
  onmessage: ((ev: MessageEvent<ParseWorkerIn>) => Promise<void>) | null;
};

let workerSelf: WorkerSelf;

async function runWorker(bytes = new ArrayBuffer(8)) {
  await import("./parseWorker");
  await workerSelf.onmessage?.({
    data: { bytes },
  } as MessageEvent<ParseWorkerIn>);
}

beforeEach(() => {
  workerSelf = {
    postMessage: vi.fn(),
    onmessage: null,
  };
  vi.stubGlobal("self", workerSelf);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    }),
  );
  wasmMocks.parseDemo.mockClear();
  wasmMocks.init.mockClear();
  wasmMocks.free.mockClear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseWorker", () => {
  it("loads wasm, parses bytes, and posts a done message", async () => {
    await runWorker();
    expect(wasmMocks.init).toHaveBeenCalledOnce();
    expect(wasmMocks.parseDemo).toHaveBeenCalledOnce();
    expect(wasmMocks.free).toHaveBeenCalledOnce();
    const messages = workerSelf.postMessage.mock.calls.map((call) => call[0]);
    expect(messages.some((m) => m.type === "progress")).toBe(true);
    const done = messages.find((m) => m.type === "done");
    expect(done?.replay.header.map_name).toBe("de_mirage");
    expect(done?.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("inits wasm once when parsing two files on the same worker", async () => {
    await runWorker();
    await runWorker(new ArrayBuffer(16));
    expect(wasmMocks.init).toHaveBeenCalledOnce();
    expect(wasmMocks.parseDemo).toHaveBeenCalledTimes(2);
    expect(wasmMocks.free).toHaveBeenCalledTimes(2);
  });

  it("warms wasm without parsing when the main thread posts warmup", async () => {
    await import("./parseWorker");
    await workerSelf.onmessage?.({
      data: { type: "warmup" },
    } as MessageEvent<ParseWorkerIn>);
    expect(wasmMocks.init).toHaveBeenCalledOnce();
    expect(wasmMocks.parseDemo).not.toHaveBeenCalled();
    expect(workerSelf.postMessage).not.toHaveBeenCalled();
  });

  it("posts an error when wasm fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );
    await runWorker();
    const err = workerSelf.postMessage.mock.calls.at(-1)?.[0];
    expect(err).toEqual({
      type: "error",
      message: "failed to fetch Wasm: 404 Not Found",
    });
  });

  it("retries wasm init after a failed fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );
    await runWorker();
    expect(wasmMocks.init).not.toHaveBeenCalled();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      }),
    );
    workerSelf.postMessage.mockClear();
    await runWorker();
    expect(wasmMocks.init).toHaveBeenCalledOnce();
    const done = workerSelf.postMessage.mock.calls.find(
      (call) => call[0].type === "done",
    )?.[0];
    expect(done?.type).toBe("done");
  });

  it("posts an error when parsing throws", async () => {
    wasmMocks.parseDemo.mockImplementation(() => {
      throw new Error("bad demo");
    });
    await runWorker();
    const err = workerSelf.postMessage.mock.calls.at(-1)?.[0];
    expect(err).toEqual({ type: "error", message: "bad demo" });
  });

  it("maps Source 2 parser failures onto GOTV drop copy", async () => {
    wasmMocks.parseDemo.mockImplementation(() => {
      throw new Error("Supports only Source 2 replays");
    });
    await runWorker();
    const err = workerSelf.postMessage.mock.calls.at(-1)?.[0];
    expect(err.type).toBe("error");
    expect(err.message).toContain("not a Counter-Strike 2 demo");
  });

  it("copies non-empty tick buffers before freeing wasm memory", async () => {
    wasmMocks.parseDemo.mockImplementation(
      (
        _data: Uint8Array,
        _stride: number,
        _withProgress: boolean,
        onProgress?: (current: number, total: number) => void,
      ) => {
        onProgress?.(2, 4);
        return {
          headerJson: () => JSON.stringify(header),
          playersJson: () => "[]",
          roundsJson: () => "[]",
          grenadesJson: () => "[]",
          shotsJson: () => "[]",
          killsJson: () => "[]",
          hurtsJson: () => "[]",
          blindsJson: () => "[]",
          bombEventsJson: () => "[]",
          buyEventsJson: () => "[]",
          controllerDumpJson: () => "[]",
          frameCount: () => 1,
          playerCount: () => 2,
          ticks: () => new Uint32Array([64]),
          x: () => new Float32Array([1, 2]),
          y: () => new Float32Array([3, 4]),
          z: () => new Float32Array([5, 6]),
          yaw: () => new Float32Array([7, 8]),
          health: () => new Uint8Array([100, 80]),
          armor: () => new Uint8Array([1, 0]),
          flags: () => new Uint8Array([17, 17]),
          money: () => new Uint16Array([800, 1600]),
          equip: () => new Uint16Array([4000, 3500]),
          gear: () => new Uint16Array([0, 0]),
          primary: () => new Uint8Array([7, 9]),
          secondary: () => new Uint8Array([1, 2]),
          active: () => new Uint8Array([7, 1]),
          clip: () => new Uint8Array([30, 0]),
          reserve: () => new Uint16Array([90, 0]),
          free: wasmMocks.free,
        } as unknown as ReturnType<typeof wasmMocks.parseDemo>;
      },
    );
    await runWorker();
    const done = workerSelf.postMessage.mock.calls.find(
      (call) => call[0].type === "done",
    )?.[0];
    expect(done?.replay.ticks.frameCount).toBe(1);
    expect(done?.replay.ticks.x).toEqual(new Float32Array([1, 2]));
    const transfer = workerSelf.postMessage.mock.calls.find(
      (call) => call[0].type === "done",
    )?.[1];
    expect(transfer?.transfer).toHaveLength(16);
  });
});
