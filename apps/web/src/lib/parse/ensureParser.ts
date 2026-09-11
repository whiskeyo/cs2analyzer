import type { CreateWorker } from "./parsePool";

let loading: Promise<CreateWorker> | null = null;
let factory: CreateWorker | null = null;
let rawFactory: CreateWorker | null = null;
let unusedWarm: Worker | null = null;
let createdCount = 0;

function wrapped(): Worker {
  const existing = unusedWarm;
  unusedWarm = null;
  createdCount += 1;
  if (existing) {
    return existing;
  }
  if (!rawFactory) {
    throw new Error("parser factory missing");
  }
  return rawFactory();
}

/**
 * Load the parse-worker constructor. Does not fetch WASM until a worker is
 * constructed (first drop, or `prefetchParser`).
 */
export function ensureParser(): Promise<CreateWorker> {
  if (factory) {
    return Promise.resolve(factory);
  }
  loading ??= import("./parseWorkerFactory")
    .then((mod) => {
      rawFactory = mod.createParseWorker;
      factory = wrapped;
      return factory;
    })
    .catch((err: unknown) => {
      loading = null;
      throw err;
    });
  return loading;
}

/** Sync constructor after `ensureParser` / prefetch has finished; otherwise null. */
export function parserFactory(): CreateWorker | null {
  return factory;
}

/**
 * Start worker + WASM download on dropzone hover / pointerdown.
 * No-op on initial paint. Reuses the warm worker on the first parse.
 */
export function prefetchParser(): void {
  if (unusedWarm || createdCount > 0 || typeof Worker === "undefined") {
    return;
  }
  void ensureParser()
    .then(() => {
      if (unusedWarm || createdCount > 0 || !rawFactory) {
        return;
      }
      unusedWarm = rawFactory();
      unusedWarm.postMessage({ type: "warmup" });
    })
    .catch(() => undefined);
}

/** Drop a prefetch worker that never joined the parse pool (session close). */
export function discardParserWarmup(): void {
  unusedWarm?.terminate();
  unusedWarm = null;
  createdCount = 0;
}
