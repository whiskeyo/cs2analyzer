import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerOut } from "@/lib/replay/replayTypes";
import type { Status } from "@/lib/state/status";
import { loadedDemo, type LoadedDemo } from "./session";
import { formatParseTimings } from "./timings";

/** Injectable so tests can drive the app without instantiating WASM. */
export type CreateWorker = () => Worker;

function defaultCreateWorker(): Worker {
  return new Worker(new URL("./parseWorker.ts", import.meta.url), { type: "module" });
}

export interface ParseProgress {
  current: number;
  total: number;
}

/**
 * Owns the active demo: one GOTV file at a time, parsed off the main thread.
 * The replay and its file name are published together as a single `LoadedDemo`
 * so downstream stores never see one without the other.
 */
export function useDemoSession(opts: { status: Status; createWorker?: CreateWorker }) {
  const { status } = opts;
  const createWorkerRef = useRef(opts.createWorker ?? defaultCreateWorker);
  createWorkerRef.current = opts.createWorker ?? createWorkerRef.current;
  const statusRef = useRef(status);
  statusRef.current = status;

  const [demo, setDemo] = useState<LoadedDemo | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const parseDemo = useCallback((file: File) => {
    statusRef.current.clear();
    setParsing(true);
    setProgress({ current: 0, total: 1 });
    setDemo(null);
    workerRef.current?.terminate();
    const worker = createWorkerRef.current();
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const msg = ev.data;
      if (msg.type === "progress") {
        setProgress({ current: msg.current, total: msg.total });
        return;
      }
      setParsing(false);
      worker.terminate();
      if (msg.type !== "done") {
        statusRef.current.setError(msg.message);
        return;
      }
      const parseNotice = formatParseTimings(msg.timings);
      console.info("[cs2analyzer parse]", msg.timings, parseNotice);
      statusRef.current.setNotice(parseNotice);
      setDemo(loadedDemo(msg.replay, file.name));
    };
    worker.onerror = (e) => {
      statusRef.current.setError(e.message || "Worker failed");
      setParsing(false);
      worker.terminate();
    };
    void file.arrayBuffer().then((bytes) => worker.postMessage({ bytes }, [bytes]));
  }, []);

  /** "New demo": back to the splash. Saved notes are untouched. */
  const close = useCallback(() => {
    workerRef.current?.terminate();
    setDemo(null);
    setParsing(false);
    setProgress(null);
  }, []);

  return {
    demo,
    replay: demo?.replay ?? null,
    fileName: demo?.fileName ?? "",
    parsing,
    progress,
    parseDemo,
    close,
  };
}

export type DemoSession = ReturnType<typeof useDemoSession>;
