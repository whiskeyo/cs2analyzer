/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
import { makeReplay } from "@/lib/testing/fixtures";
import type { Status } from "@/lib/state/status";
import { DB_NAME, PARSED_DEMO_STORE, openCs2Db, requestOf } from "@/lib/storage/idb";
import { CS2_DEMO_MAGIC } from "./demoFile";
import { parserCacheFileKey, readFreshParserCache, saveParserCache } from "./parserCache";
import { useDemoSession } from "./useDemoSession";

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
  terminate = vi.fn();
  postMessage() {}
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

function demoBuffer(extra = "body"): ArrayBuffer {
  const bytes = new TextEncoder().encode(`${CS2_DEMO_MAGIC}${extra}`);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function deleteCs2Db(): Promise<void> {
  const closing = indexedDB.deleteDatabase(DB_NAME);
  return new Promise((resolve, reject) => {
    closing.onsuccess = () => resolve();
    closing.onerror = () => reject(closing.error ?? new Error("deleteDatabase failed"));
    closing.onblocked = () => resolve();
  });
}

async function putRaw(row: Record<string, unknown>): Promise<void> {
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PARSED_DEMO_STORE, "readwrite");
    await requestOf(tx.objectStore(PARSED_DEMO_STORE).put(row));
  } finally {
    db.close();
  }
}

function renderSession() {
  const workers: FakeWorker[] = [];
  const status = makeStatus();
  const createWorker = () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const view = renderHook(() => useDemoSession({ status, createWorker }));
  return { ...view, workers, status };
}

describe("useDemoSession parser cache", () => {
  beforeEach(async () => {
    await deleteCs2Db();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
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

  it("loads a matching schema from the cache without parsing", async () => {
    const source = demoBuffer();
    const file = new File([source], "match.dem", { lastModified: 20 });
    const replay = makeReplay({ header: { team_ct: "Cached" } });
    await saveParserCache({
      key: parserCacheFileKey(file),
      fileName: file.name,
      replay,
      matchKey: "notes",
      lastModified: file.lastModified,
      source,
    });
    const { result, workers, status } = renderSession();

    await act(async () => {
      await result.current.parseDemo(file);
    });

    expect(workers).toHaveLength(0);
    expect(result.current.parsing).toBe(false);
    expect(result.current.demo?.replay.header.team_ct).toBe("Cached");
    expect(status.setNotice).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith("[cs2analyzer parse]", "match.dem", "cache hit");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("re-parses a stale row on load and then serves the fresh row", async () => {
    const source = demoBuffer();
    const file = new File([source], "match.dem", { lastModified: 50 });
    const key = parserCacheFileKey(file);
    await putRaw({
      key,
      schema: 0,
      fileName: file.name,
      savedAt: 1,
      replay: makeReplay({ header: { team_ct: "Stale" } }),
      source,
      fileKey: key,
      matchKey: "notes",
      lastModified: file.lastModified,
    });
    const { result, workers, status } = renderSession();
    const fresh: Replay = makeReplay({ header: { team_ct: "Fresh" } });

    await waitFor(() => expect(workers).toHaveLength(1));
    await act(async () => {
      workers[0].emit({ type: "done", replay: fresh, timings: TIMINGS });
    });
    await waitFor(async () => {
      expect((await readFreshParserCache(key))?.header.team_ct).toBe("Fresh");
    });

    await act(async () => {
      await result.current.parseDemo(file);
    });

    expect(workers).toHaveLength(1);
    expect(result.current.demo?.replay.header.team_ct).toBe("Fresh");
    expect(result.current.parsing).toBe(false);
    expect(status.setNotice).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      "[cs2analyzer parse]",
      "match.dem",
      "Parsed in 10ms (WASM 2ms, JSON 3ms, buffers 4ms)",
      TIMINGS,
      expect.any(Object),
    );
    expect(console.info).toHaveBeenCalledWith("[cs2analyzer parse]", "match.dem", "cache hit");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not parse when a stale row has no demo bytes", async () => {
    const key = "no-bytes";
    await putRaw({
      key,
      schema: 0,
      fileName: "match.dem",
      savedAt: 1,
      replay: makeReplay({ header: { team_ct: "Stale" } }),
      fileKey: key,
      matchKey: "notes",
      lastModified: 1,
    });
    const { workers } = renderSession();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(workers).toHaveLength(0);
    expect(await readFreshParserCache(key)).toBeNull();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
