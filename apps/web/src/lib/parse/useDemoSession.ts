import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerOut } from "@/lib/replay/replayTypes";
import type { Status } from "@/lib/state/status";
import { SERIES_MAX_FILES } from "@/lib/shared/constants";
import {
  buildSeriesDemos,
  parsePoolBar,
  parsePoolSize,
  runParsePool,
  type ParseFileProgress,
  type ParsePoolProgress,
} from "./parsePool";
import {
  buildSeries,
  loadedDemo,
  withFocalTeam,
  type DemoSeries,
  type LoadedDemo,
} from "./session";
import { formatParseTimings } from "./timings";
import { clearSeriesReviewCache } from "@/lib/notes/seriesReviewCache";

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
 * Owns the active demo and optional same-map series.
 * Single-file drop keeps the old path; multi-file uses a small worker pool.
 */
export function useDemoSession(opts: {
  status: Status;
  createWorker?: CreateWorker;
  onBeforeSelectDemo?: () => void;
}) {
  const { status, onBeforeSelectDemo } = opts;
  const createWorkerRef = useRef(opts.createWorker ?? defaultCreateWorker);
  createWorkerRef.current = opts.createWorker ?? createWorkerRef.current;
  const statusRef = useRef(status);
  statusRef.current = status;

  const [demo, setDemo] = useState<LoadedDemo | null>(null);
  const [series, setSeries] = useState<DemoSeries | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [parseFiles, setParseFiles] = useState<ParseFileProgress[] | null>(null);
  const [switching, setSwitching] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const parseGenRef = useRef(0);
  const progressRafRef = useRef(0);
  const onBeforeSelectRef = useRef(onBeforeSelectDemo);
  onBeforeSelectRef.current = onBeforeSelectDemo;

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    },
    [],
  );

  const scheduleProgress = useCallback((current: number, total: number) => {
    if (progressRafRef.current) return;
    progressRafRef.current = requestAnimationFrame(() => {
      progressRafRef.current = 0;
      setProgress({ current, total });
    });
  }, []);

  const finishSingle = useCallback((next: LoadedDemo) => {
    setSeries(null);
    setDemo(next);
  }, []);

  const parseDemo = useCallback(
    (file: File) => {
      const gen = ++parseGenRef.current;
      statusRef.current.clear();
      setParsing(true);
      setProgress({ current: 0, total: 100 });
      setParseFiles(null);
      setDemo(null);
      setSeries(null);
      workerRef.current?.terminate();
      const worker = createWorkerRef.current();
      workerRef.current = worker;
      worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
        if (gen !== parseGenRef.current) return;
        const msg = ev.data;
        if (msg.type === "progress") {
          const workerTotal = msg.total > 0 ? msg.total : 1;
          scheduleProgress(Math.round((100 * msg.current) / workerTotal), 100);
          return;
        }
        if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = 0;
        setParsing(false);
        worker.terminate();
        workerRef.current = null;
        if (msg.type !== "done") {
          statusRef.current.setError(msg.message);
          return;
        }
        const parseNotice = formatParseTimings(msg.timings);
        console.info("[cs2analyzer parse]", msg.timings, parseNotice);
        statusRef.current.setNotice(parseNotice);
        finishSingle(loadedDemo(msg.replay, file.name, file));
      };
      worker.onerror = (e) => {
        if (gen !== parseGenRef.current) return;
        statusRef.current.setError(e.message || "Worker failed");
        setParsing(false);
        worker.terminate();
        workerRef.current = null;
      };
      void file.arrayBuffer().then((bytes) => worker.postMessage({ bytes }, [bytes]));
    },
    [finishSingle, scheduleProgress],
  );

  const parseDemos = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length === 1) {
        parseDemo(files[0]);
        return;
      }
      if (files.length > SERIES_MAX_FILES) {
        statusRef.current.setError(`Series supports at most ${SERIES_MAX_FILES} demos.`);
        return;
      }

      const gen = ++parseGenRef.current;
      statusRef.current.clear();
      clearSeriesReviewCache();
      setParsing(true);
      setProgress({ current: 0, total: files.length * 100 });
      setParseFiles(
        files.map((file, index) => ({
          name: file.name,
          index,
          state: "queued",
          pct: 0,
        })),
      );
      setDemo(null);
      setSeries(null);
      workerRef.current?.terminate();
      workerRef.current = null;

      const onPoolProgress = (pool: ParsePoolProgress) => {
        if (gen !== parseGenRef.current) return;
        const bar = parsePoolBar(pool);
        scheduleProgress(bar.current, bar.total);
        setParseFiles(pool.files);
      };

      const wall0 = performance.now();
      const poolWorkers = parsePoolSize(files.length);
      const results = await runParsePool(createWorkerRef.current, files, onPoolProgress);
      if (gen !== parseGenRef.current) return;

      const wallMs = performance.now() - wall0;
      setParsing(false);
      setParseFiles(null);
      const { demos, mapName, skipped } = buildSeriesDemos(results);
      for (const line of skipped) statusRef.current.setNotice(line);

      if (demos.length === 0) {
        statusRef.current.setError("No demos parsed for this series.");
        return;
      }

      const nextSeries = buildSeries(mapName, demos);
      setSeries(nextSeries);
      setDemo(demos[0]);

      const ok = results.filter((r) => r.demo && !r.error);
      if (ok.length > 0) {
        const maxWasm = Math.max(...ok.map((r) => r.timings?.parseMs ?? 0));
        console.info("[cs2analyzer parse series]", {
          wallMs,
          poolWorkers,
          files: ok.length,
          maxWasmMs: maxWasm,
          perFile: ok.map((r) => ({
            name: r.file.name,
            parseMs: r.timings?.parseMs,
            totalMs: r.timings?.totalMs,
          })),
        });
      }
      statusRef.current.setNotice(
        `Series: ${demos.length} ${mapName} demo${demos.length === 1 ? "" : "s"} · ${nextSeries.focalTeam}`,
      );
    },
    [parseDemo, scheduleProgress],
  );

  const selectDemo = useCallback(
    (id: string) => {
      if (!series) return;
      const next = series.demos.find((d) => d.id === id);
      if (!next || next.id === demo?.id) return;
      onBeforeSelectRef.current?.();
      setSwitching(true);
      requestAnimationFrame(() => {
        setDemo(next);
        requestAnimationFrame(() => setSwitching(false));
      });
    },
    [series, demo?.id],
  );

  const setFocalTeam = useCallback((name: string) => {
    setSeries((prev) => (prev ? withFocalTeam(prev, name) : prev));
  }, []);

  /** "New demo": back to the splash. Saved notes are untouched. */
  const close = useCallback(() => {
    parseGenRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setDemo(null);
    setSeries(null);
    setParsing(false);
    setProgress(null);
    setParseFiles(null);
    setSwitching(false);
  }, []);

  return {
    demo,
    series,
    replay: demo?.replay ?? null,
    fileName: demo?.fileName ?? "",
    parsing,
    progress,
    parseFiles,
    switching,
    parseDemo,
    parseDemos,
    selectDemo,
    setFocalTeam,
    close,
  };
}

export type DemoSession = ReturnType<typeof useDemoSession>;
