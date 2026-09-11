import { useCallback, useEffect, useRef, useState } from "react";
import type { Status } from "@/lib/state/status";
import { PARSE_POOL_MAX, SERIES_MAX_FILES } from "@/lib/shared/constants";
import { errorMessage } from "@/lib/validate/json.ts";
import {
  createParseWorkerPool,
  groupParsedDemosByMap,
  parsePoolBar,
  parsePoolSize,
  runParsePool,
  type CreateWorker,
  type ParseFileProgress,
  type ParsePoolProgress,
  type ParseWorkerPool,
} from "./parsePool";
import { discardParserWarmup, ensureParser, parserFactory } from "./ensureParser";
import { buildSeries, withFocalTeam, type DemoSeries, type LoadedDemo } from "./session";
import { formatParseTimings } from "./timings";
import { parseDump } from "./parseDump";
import { clearSeriesReviewCache } from "@/lib/notes/seriesReviewCache";

export type { CreateWorker };

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
  parsePoolMax?: number;
  seriesMaxFiles?: number;
}) {
  const { status, onBeforeSelectDemo } = opts;
  const createWorkerRef = useRef(opts.createWorker);
  createWorkerRef.current = opts.createWorker ?? createWorkerRef.current;
  const statusRef = useRef(status);
  statusRef.current = status;
  const parsePoolMaxRef = useRef(opts.parsePoolMax ?? PARSE_POOL_MAX);
  parsePoolMaxRef.current = opts.parsePoolMax ?? PARSE_POOL_MAX;
  const seriesMaxFilesRef = useRef(opts.seriesMaxFiles ?? SERIES_MAX_FILES);
  seriesMaxFilesRef.current = opts.seriesMaxFiles ?? SERIES_MAX_FILES;

  const [demo, setDemo] = useState<LoadedDemo | null>(null);
  const [series, setSeries] = useState<DemoSeries | null>(null);
  const [mapGroups, setMapGroups] = useState<{ mapName: string; demos: LoadedDemo[] }[]>([]);
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null);
  /** Every demo from the last multi-file drop (all maps); cleared on single-file load / close. */
  const [parsedDemos, setParsedDemos] = useState<LoadedDemo[]>([]);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [parseFiles, setParseFiles] = useState<ParseFileProgress[] | null>(null);
  const [switching, setSwitching] = useState(false);
  const poolRef = useRef<ParseWorkerPool | null>(null);
  const parseGenRef = useRef(0);
  const parsingRef = useRef(false);
  const progressRafRef = useRef(0);
  const onBeforeSelectRef = useRef(onBeforeSelectDemo);
  onBeforeSelectRef.current = onBeforeSelectDemo;

  const getPool = useCallback((): ParseWorkerPool | Promise<ParseWorkerPool> => {
    if (poolRef.current) {
      return poolRef.current;
    }
    const injected = createWorkerRef.current;
    if (injected) {
      poolRef.current = createParseWorkerPool(injected);
      return poolRef.current;
    }
    const ready = parserFactory();
    if (ready) {
      poolRef.current = createParseWorkerPool(ready);
      return poolRef.current;
    }
    return ensureParser().then((create) => {
      poolRef.current ??= createParseWorkerPool(create);
      return poolRef.current;
    });
  }, []);

  useEffect(
    () => () => {
      poolRef.current?.reset();
      discardParserWarmup();
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
    setMapGroups([]);
    setSelectedMapName(null);
    setParsedDemos([]);
    setSeries(null);
    setDemo(next);
  }, []);

  const loadMapGroup = useCallback((group: { mapName: string; demos: LoadedDemo[] }) => {
    setSelectedMapName(group.mapName);
    setSeries(buildSeries(group.mapName, group.demos));
    setDemo(group.demos[0]);
  }, []);

  const beginParse = useCallback(() => {
    const gen = ++parseGenRef.current;
    if (parsingRef.current) {
      poolRef.current?.reset();
    }
    parsingRef.current = true;
    return gen;
  }, []);

  const endParse = useCallback(() => {
    parsingRef.current = false;
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    progressRafRef.current = 0;
    setParsing(false);
  }, []);

  const parseDemo = useCallback(
    (file: File) => {
      const gen = beginParse();
      statusRef.current.clear();
      setParsing(true);
      setProgress({ current: 0, total: 100 });
      setParseFiles(null);
      setDemo(null);
      setSeries(null);
      setMapGroups([]);
      setSelectedMapName(null);
      setParsedDemos([]);

      const fail = (err: unknown) => {
        if (gen !== parseGenRef.current) return;
        endParse();
        statusRef.current.setError(errorMessage(err));
      };

      const run = (pool: ParseWorkerPool) => {
        void pool
          .parseFile(file, (current, workerTotal) => {
            if (gen !== parseGenRef.current) return;
            const total = workerTotal > 0 ? workerTotal : 1;
            scheduleProgress(Math.round((100 * current) / total), 100);
          })
          .then((result) => {
            if (gen !== parseGenRef.current) return;
            endParse();
            if (result.cancelled) return;
            if (result.error || !result.demo || !result.timings) {
              statusRef.current.setError(result.error ?? "Parse failed");
              return;
            }
            const parseNotice = formatParseTimings(result.timings);
            console.info(
              "[cs2analyzer parse]",
              result.timings,
              parseNotice,
              parseDump(result.demo.replay),
            );
            statusRef.current.setNotice(parseNotice);
            finishSingle(result.demo);
          });
      };

      const poolOrPromise = getPool();
      if (poolOrPromise instanceof Promise) {
        void poolOrPromise.then(run).catch(fail);
        return;
      }
      run(poolOrPromise);
    },
    [beginParse, endParse, finishSingle, getPool, scheduleProgress],
  );

  const parseDemos = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length === 1) {
        parseDemo(files[0]);
        return;
      }
      if (files.length > seriesMaxFilesRef.current) {
        statusRef.current.setError(`Series supports at most ${seriesMaxFilesRef.current} demos.`);
        return;
      }

      const gen = beginParse();
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
      setMapGroups([]);
      setSelectedMapName(null);
      setParsedDemos([]);

      const onPoolProgress = (pool: ParsePoolProgress) => {
        if (gen !== parseGenRef.current) return;
        const bar = parsePoolBar(pool);
        scheduleProgress(bar.current, bar.total);
        setParseFiles(pool.files);
      };

      const wall0 = performance.now();
      const poolWorkers = parsePoolSize(files.length, parsePoolMaxRef.current);
      let pool: ParseWorkerPool;
      try {
        const poolOrPromise = getPool();
        pool = poolOrPromise instanceof Promise ? await poolOrPromise : poolOrPromise;
      } catch (err: unknown) {
        if (gen !== parseGenRef.current) return;
        endParse();
        statusRef.current.setError(errorMessage(err));
        return;
      }
      if (gen !== parseGenRef.current) return;
      const results = await runParsePool(pool, files, onPoolProgress, parsePoolMaxRef.current);
      if (gen !== parseGenRef.current) return;

      const wallMs = performance.now() - wall0;
      endParse();
      setParseFiles(null);
      const { groups, skipped } = groupParsedDemosByMap(results);
      for (const line of skipped) statusRef.current.setNotice(line);

      if (groups.length === 0) {
        statusRef.current.setError("No demos parsed for this series.");
        return;
      }

      setMapGroups(groups);
      setParsedDemos(groups.flatMap((g) => g.demos));
      loadMapGroup(groups[0]);
      const nextSeries = buildSeries(groups[0].mapName, groups[0].demos);

      const ok = results.filter((r) => r.demo && !r.error);
      if (ok.length > 0) {
        const maxWasm = Math.max(...ok.map((r) => r.timings?.parseMs ?? 0));
        console.info("[cs2analyzer parse series]", {
          wallMs,
          poolWorkers,
          files: ok.length,
          maps: groups.map((g) => ({ map: g.mapName, demos: g.demos.length })),
          maxWasmMs: maxWasm,
          perFile: ok.map((r) => ({
            name: r.file.name,
            parseMs: r.timings?.parseMs,
            totalMs: r.timings?.totalMs,
          })),
        });
      }
      const mapSummary =
        groups.length > 1
          ? `${groups.length} maps (${groups.map((g) => `${g.demos.length}× ${g.mapName}`).join(", ")})`
          : groups[0].mapName;
      statusRef.current.setNotice(
        `Series: ${groups[0].demos.length} ${groups[0].mapName} demo${groups[0].demos.length === 1 ? "" : "s"} · ${nextSeries.focalTeam}${groups.length > 1 ? ` · ${mapSummary}` : ""}`,
      );
    },
    [beginParse, endParse, getPool, loadMapGroup, parseDemo, scheduleProgress],
  );

  const selectMap = useCallback(
    (mapName: string) => {
      if (mapName === selectedMapName) return;
      const group = mapGroups.find((g) => g.mapName === mapName);
      if (!group) return;
      onBeforeSelectRef.current?.();
      clearSeriesReviewCache();
      setSwitching(true);
      loadMapGroup(group);
      requestAnimationFrame(() => requestAnimationFrame(() => setSwitching(false)));
    },
    [loadMapGroup, mapGroups, selectedMapName],
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
    parsingRef.current = false;
    poolRef.current?.reset();
    discardParserWarmup();
    setDemo(null);
    setSeries(null);
    setMapGroups([]);
    setSelectedMapName(null);
    setParsedDemos([]);
    setParsing(false);
    setProgress(null);
    setParseFiles(null);
    setSwitching(false);
  }, []);

  return {
    demo,
    series,
    mapGroups,
    selectedMapName,
    parsedDemos,
    replay: demo?.replay ?? null,
    fileName: demo?.fileName ?? "",
    parsing,
    progress,
    parseFiles,
    switching,
    parseDemo,
    parseDemos,
    selectDemo,
    selectMap,
    setFocalTeam,
    close,
  };
}

export type DemoSession = ReturnType<typeof useDemoSession>;
