import { type Replay, type WorkerOut } from "@/lib/replay/replayTypes";
import {
  DEFAULT_LAYERS,
  DEFAULT_SUMMARY_FILTER,
  type FloorMode,
  type MapLayers,
  type Stroke,
  type SummaryFilter,
} from "@/lib/notes/types";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { isNotesFile, loadProject, matchKey } from "@/lib/notes/projectStore";
import { loadedDemo } from "./session";
import { useCallback, useRef, useState, type MutableRefObject } from "react";

/**
 * Parses one GOTV file at a time into the active replay.
 * Multi-demo overlay should append LoadedDemo rows for the same map instead of replacing.
 */
export function useDemoParse(opts: {
  persistNow: () => Promise<void>;
  importNotesText: (text: string) => Promise<void>;
  commitStrokes: (next: Stroke[], reset?: boolean) => void;
  applyProject: (p: ReviewProject, jumpTick: boolean) => void;
  jump: (t: number, pause?: boolean) => void;
  setReplay: (r: Replay | null) => void;
  setFileName: (n: string) => void;
  setFollow: (v: boolean) => void;
  setSelected: (i: number | null) => void;
  setLayers: (l: MapLayers) => void;
  setSummaryFilter: (f: SummaryFilter) => void;
  setFloorMode: (m: FloorMode) => void;
  setError: (e: string | null) => void;
  setNotice: (n: string | null) => void;
  setPlaying: (v: boolean) => void;
  setTick: (t: number) => void;
  tickRef: MutableRefObject<number>;
}) {
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const onFile = useCallback((file: File) => {
    const o = optsRef.current;
    if (isNotesFile(file)) {
      void file.text().then((text) => o.importNotesText(text));
      return;
    }
    void o.persistNow();
    o.setError(null);
    o.setNotice(null);
    setParsing(true);
    setProgress({ current: 0, total: 1 });
    o.setReplay(null);
    o.setFileName(file.name);
    o.commitStrokes([], true);
    o.setFollow(false);
    o.setSelected(null);
    o.setLayers(DEFAULT_LAYERS);
    o.setSummaryFilter(DEFAULT_SUMMARY_FILTER);
    o.setFloorMode("auto");
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./parseWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const msg = ev.data;
      if (msg.type === "progress") {
        setProgress({ current: msg.current, total: msg.total });
      } else if (msg.type === "done") {
        const demo = loadedDemo(msg.replay, file.name);
        o.setReplay(demo.replay);
        const first = demo.replay.rounds.find((r) => !r.is_knife) ?? demo.replay.rounds[0];
        const start = first?.freeze_end_tick ?? demo.replay.ticks.ticks[0] ?? 0;
        o.tickRef.current = start;
        o.setTick(start);
        setParsing(false);
        worker.terminate();
        void loadProject(matchKey(demo.replay, demo.fileName))
          .then((p) => {
            if (p) {
              o.applyProject(p, true);
              o.setPlaying(false);
              o.setNotice("Restored drawings for this match.");
            } else {
              o.setPlaying(true);
            }
          })
          .catch(() => o.setPlaying(true));
      } else {
        o.setError(msg.message);
        setParsing(false);
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      o.setError(e.message || "Worker failed");
      setParsing(false);
      worker.terminate();
    };
    file.arrayBuffer().then((bytes) => worker.postMessage({ bytes }, [bytes]));
  }, []);

  return { parsing, progress, onFile };
}
