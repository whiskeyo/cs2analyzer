import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const createParseWorker = vi.fn();

vi.mock("./parseWorkerFactory", () => ({
  createParseWorker: (...args: unknown[]) => createParseWorker(...args),
}));

class FakeWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
}

function srcFile(rel: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), rel), "utf8");
}

describe("parser load graph", () => {
  const forbidden = ["parseWorker.ts", "cs2analyzer_wasm", "new Worker"];
  const files = [
    "../../components/app/App.tsx",
    "../../pages/Home.tsx",
    "../../pages/Faq.tsx",
    "../../pages/Playbook.tsx",
    "../state/sessionState.tsx",
    "./useDemoSession.ts",
    "../../components/app/DropZone.tsx",
  ];

  it.each(files)("%s does not statically pull the parse worker or WASM", (rel) => {
    const text = srcFile(rel);
    for (const token of forbidden) {
      expect(text, `${rel} contains ${token}`).not.toContain(token);
    }
  });

  it("keeps the Worker URL in the lazy factory module", () => {
    const text = srcFile("./parseWorkerFactory.ts");
    expect(text).toContain("parseWorker.ts");
    expect(text).toContain("new Worker");
  });
});

describe("ensureParser", () => {
  beforeEach(() => {
    createParseWorker.mockReset();
    createParseWorker.mockImplementation(() => new FakeWorker());
    vi.stubGlobal("Worker", FakeWorker);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the factory once and exposes it synchronously afterwards", async () => {
    const { ensureParser, parserFactory } = await import("./ensureParser");
    expect(parserFactory()).toBeNull();
    const first = await ensureParser();
    const second = await ensureParser();
    expect(first).toBe(second);
    expect(parserFactory()).toBe(first);
    expect(createParseWorker).not.toHaveBeenCalled();
  });

  it("prefetches one worker and hands it to the first create()", async () => {
    const { ensureParser, prefetchParser } = await import("./ensureParser");
    prefetchParser();
    const create = await ensureParser();
    await Promise.resolve();
    expect(createParseWorker).toHaveBeenCalledOnce();
    const warm = createParseWorker.mock.results[0]?.value as FakeWorker;
    expect(warm.postMessage).toHaveBeenCalledWith({ type: "warmup" });

    const first = create();
    expect(first).toBe(warm);
    expect(createParseWorker).toHaveBeenCalledOnce();

    create();
    expect(createParseWorker).toHaveBeenCalledTimes(2);
  });

  it("does not spawn a warmup worker after the pool has already created one", async () => {
    const { ensureParser, prefetchParser } = await import("./ensureParser");
    const create = await ensureParser();
    create();
    prefetchParser();
    await Promise.resolve();
    expect(createParseWorker).toHaveBeenCalledOnce();
  });

  it("terminates an unused warmup on discard so close does not leak a worker", async () => {
    const { ensureParser, prefetchParser, discardParserWarmup } = await import("./ensureParser");
    prefetchParser();
    await ensureParser();
    await Promise.resolve();
    const warm = createParseWorker.mock.results[0]?.value as FakeWorker;
    discardParserWarmup();
    expect(warm.terminate).toHaveBeenCalledOnce();
  });
});
