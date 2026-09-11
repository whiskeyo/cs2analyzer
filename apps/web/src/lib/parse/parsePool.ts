import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
import { PARSE_POOL_HARD_MAX, PARSE_POOL_MAX, PARSE_POOL_MIN } from "@/lib/shared/constants";
import { loadedDemo, type LoadedDemo } from "./session";

/** Injectable so tests can drive parse without instantiating WASM. */
export type CreateWorker = () => Worker;

export interface ParseFileResult {
  file: File;
  demo?: LoadedDemo;
  error?: string;
  timings?: ParseTimings;
  /** True when the pool was reset while this job was in flight. */
  cancelled?: boolean;
}

export interface ParsePoolProgress {
  completed: number;
  total: number;
  /** Sum of in-flight worker progress fractions (0–poolSize). */
  inFlightFraction: number;
  files: ParseFileProgress[];
}

export type ParseFileState = "queued" | "parsing" | "done" | "error";

export interface ParseFileProgress {
  name: string;
  index: number;
  state: ParseFileState;
  pct: number;
}

/** Worker count: user cap, hardware, and file count. */
export function parsePoolSize(fileCount: number, parsePoolMax = PARSE_POOL_MAX): number {
  const hw =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 2;
  return Math.min(parsePoolMax, PARSE_POOL_HARD_MAX, hw, fileCount);
}

/** Slider ceiling: user hard max, limited by this machine's cores. */
export function parsePoolHardwareCap(): number {
  const hw =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : PARSE_POOL_HARD_MAX;
  return Math.min(PARSE_POOL_HARD_MAX, Math.max(PARSE_POOL_MIN, hw));
}

export function mapNameFromReplay(replay: Replay): string {
  return replay.header.map_name;
}

/** Group successful parses by map; drop order is preserved within each map. */
export function groupParsedDemosByMap(results: ParseFileResult[]): {
  groups: { mapName: string; demos: LoadedDemo[] }[];
  skipped: string[];
} {
  const skipped: string[] = [];
  const order: string[] = [];
  const byMap = new Map<string, LoadedDemo[]>();

  for (const result of results) {
    if (result.error) {
      skipped.push(`${result.file.name}: ${result.error}`);
      continue;
    }
    if (!result.demo) continue;
    const map = mapNameFromReplay(result.demo.replay);
    if (!byMap.has(map)) order.push(map);
    const list = byMap.get(map) ?? [];
    list.push(result.demo);
    byMap.set(map, list);
  }

  const groups = order.map((mapName) => ({ mapName, demos: byMap.get(mapName)! }));
  groups.sort((a, b) => b.demos.length - a.demos.length || a.mapName.localeCompare(b.mapName));
  return { groups, skipped };
}

interface PendingParseJob {
  settle: () => void;
}

export interface ParseWorkerPool {
  parseFile(
    file: File,
    onWorkerProgress: (current: number, total: number) => void,
  ): Promise<ParseFileResult>;
  /** Terminate every slot. In-flight jobs settle as cancelled. */
  reset(): void;
}

/**
 * Warm parse workers: WASM inits once per slot. Callers cap concurrency with
 * `parsePoolSize`. `reset` on session close, cancelled in-flight parse, or tests.
 */
export function createParseWorkerPool(createWorker: CreateWorker): ParseWorkerPool {
  const live = new Set<Worker>();
  const idle: Worker[] = [];
  const pending = new Map<Worker, PendingParseJob>();
  let generation = 0;

  const acquire = (): Worker => {
    const existing = idle.pop();
    if (existing) return existing;
    const worker = createWorker();
    live.add(worker);
    return worker;
  };

  return {
    parseFile(file, onWorkerProgress) {
      return new Promise((resolve) => {
        const jobGen = generation;
        const worker = acquire();
        let settled = false;

        const settle = (result: ParseFileResult, discardSlot: boolean) => {
          if (settled) return;
          settled = true;
          pending.delete(worker);
          worker.onmessage = null;
          worker.onerror = null;
          if (jobGen === generation && live.has(worker)) {
            if (discardSlot) {
              live.delete(worker);
              worker.terminate();
            } else {
              idle.push(worker);
            }
          }
          resolve(result);
        };

        pending.set(worker, {
          settle: () => settle({ file, cancelled: true }, true),
        });

        worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
          const msg = ev.data;
          if (msg.type === "progress") {
            onWorkerProgress(msg.current, msg.total);
            return;
          }
          if (msg.type !== "done") {
            settle(
              {
                file,
                error: msg.type === "error" ? msg.message : "Parse failed",
              },
              false,
            );
            return;
          }
          settle(
            {
              file,
              demo: loadedDemo(msg.replay, file.name, file),
              timings: msg.timings,
            },
            false,
          );
        };
        worker.onerror = (e) => {
          settle({ file, error: e.message || "Worker failed" }, true);
        };
        void file.arrayBuffer().then((bytes) => {
          if (settled || jobGen !== generation) return;
          worker.postMessage({ bytes }, [bytes]);
        });
      });
    },

    reset() {
      generation += 1;
      const jobs = [...pending.values()];
      pending.clear();
      for (const worker of live) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
      }
      live.clear();
      idle.length = 0;
      for (const job of jobs) job.settle();
    },
  };
}

/**
 * Parse several `.dem` files with a small worker pool. Results stay in drop order.
 * Progress blends completed files with in-flight WASM tick callbacks.
 */
export async function runParsePool(
  pool: ParseWorkerPool,
  files: File[],
  onProgress: (progress: ParsePoolProgress) => void,
  parsePoolMax = PARSE_POOL_MAX,
): Promise<ParseFileResult[]> {
  const total = files.length;
  if (total === 0) return [];

  const results: ParseFileResult[] = new Array(total);
  let completed = 0;
  const inFlight = new Map<number, { current: number; total: number }>();
  const fileProgress: ParseFileProgress[] = files.map((file, index) => ({
    name: file.name,
    index,
    state: "queued",
    pct: 0,
  }));

  const poolSize = parsePoolSize(total, parsePoolMax);
  const queue = files.map((file, index) => ({ file, index }));

  let progressRaf = 0;
  let progressDirty = false;
  const emitProgress = (): ParsePoolProgress => {
    let inFlightFraction = 0;
    for (const slot of inFlight.values()) {
      inFlightFraction += slot.total > 0 ? slot.current / slot.total : 0;
    }
    return { completed, total, inFlightFraction, files: fileProgress.map((f) => ({ ...f })) };
  };
  const scheduleProgress = () => {
    if (progressDirty) return;
    progressDirty = true;
    progressRaf = requestAnimationFrame(() => {
      progressDirty = false;
      progressRaf = 0;
      onProgress(emitProgress());
    });
  };

  const flushProgress = () => {
    if (progressRaf) {
      cancelAnimationFrame(progressRaf);
      progressRaf = 0;
      progressDirty = false;
    }
    onProgress(emitProgress());
  };

  const setFile = (index: number, patch: Partial<ParseFileProgress>) => {
    const row = fileProgress[index];
    if (!row) return;
    Object.assign(row, patch);
  };

  await new Promise<void>((resolve) => {
    let active = 0;

    const report = () => scheduleProgress();

    const pump = () => {
      while (active < poolSize && queue.length > 0) {
        const job = queue.shift();
        if (!job) break;
        active += 1;
        inFlight.set(job.index, { current: 0, total: 1 });
        setFile(job.index, { state: "parsing", pct: 0 });
        report();

        void pool
          .parseFile(job.file, (current, workerTotal) => {
            inFlight.set(job.index, { current, total: workerTotal });
            const pct =
              workerTotal > 0 ? Math.min(100, Math.round((100 * current) / workerTotal)) : 0;
            setFile(job.index, { state: "parsing", pct });
            report();
          })
          .then((result) => {
            inFlight.delete(job.index);
            active -= 1;
            if (result.cancelled) {
              if (active === 0) {
                flushProgress();
                resolve();
              }
              return;
            }
            results[job.index] = result;
            completed += 1;
            if (result.error) setFile(job.index, { state: "error", pct: 100 });
            else setFile(job.index, { state: "done", pct: 100 });
            report();
            if (queue.length > 0) pump();
            else if (active === 0) {
              flushProgress();
              resolve();
            }
          });
      }
      if (active === 0 && queue.length === 0) {
        flushProgress();
        resolve();
      }
    };

    pump();
  });

  return results;
}

/** Map parse-pool progress to a single `{ current, total }` pair for the splash bar. */
export function parsePoolBar(progress: ParsePoolProgress): { current: number; total: number } {
  const current = Math.min(progress.total, progress.completed + progress.inFlightFraction);
  return { current: Math.round(current * 100), total: progress.total * 100 };
}

export function parsePoolOverallPct(progress: ParsePoolProgress): number {
  const bar = parsePoolBar(progress);
  return bar.total > 0 ? Math.min(100, Math.round((100 * bar.current) / bar.total)) : 0;
}
