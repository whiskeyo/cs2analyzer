import { tickRate } from "./constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controls } from "./Controls";
import { DropZone } from "./DropZone";
import { Hud } from "./Hud";
import { KillFeed } from "./KillFeed";
import { SpectatorEconomy } from "./SpectatorEconomy";
import { MapToolbar } from "./MapToolbar";
import { calibrationFor, loadCalibrations } from "./maps";
import { RadarCanvas } from "./RadarCanvas";
import { RoundStrip } from "./RoundStrip";
import { findExecutes, nextExecuteTick } from "./execute";
import { currentRound } from "./sample";
import { Sidebar } from "./Sidebar";
import { computeStats, exportStatsCsv, nextEventTick } from "./stats";
import {
  DEFAULT_LAYERS,
  type DrawTool,
  type MapCalibration,
  type MapLayers,
  type Replay,
  type Stroke,
  type WorkerOut,
} from "./types";
import { publicUrl } from "./publicUrl";
import { prettyMap } from "./weapons";

export function App() {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [trails, setTrails] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pan");
  const [color, setColor] = useState("#f4d35e");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [viewEpoch, setViewEpoch] = useState(0);
  const [maps, setMaps] = useState<Record<string, MapCalibration>>({});
  const workerRef = useRef<Worker | null>(null);
  const tickRef = useRef(0);
  tickRef.current = tick;
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const jump = useCallback((t: number, pause = true) => {
    tickRef.current = t;
    setTick(t);
    if (pause) setPlaying(false);
  }, []);

  useEffect(() => {
    loadCalibrations()
      .then(setMaps)
      .catch(() => undefined);
  }, []);

  const onFile = useCallback((file: File) => {
    setError(null);
    setParsing(true);
    setProgress({ current: 0, total: 1 });
    setReplay(null);
    setFileName(file.name);
    setStrokes([]);
    setFollow(false);
    setSelected(null);
    setLayers(DEFAULT_LAYERS);
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./parseWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const msg = ev.data;
      if (msg.type === "progress") {
        setProgress({ current: msg.current, total: msg.total });
      } else if (msg.type === "done") {
        setReplay(msg.replay);
        const first = msg.replay.rounds.find((r) => !r.is_knife) ?? msg.replay.rounds[0];
        const start = first?.freeze_end_tick ?? msg.replay.ticks.ticks[0] ?? 0;
        tickRef.current = start;
        setTick(start);
        setPlaying(true);
        setParsing(false);
        worker.terminate();
      } else {
        setError(msg.message);
        setParsing(false);
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      setError(e.message || "Worker failed");
      setParsing(false);
      worker.terminate();
    };
    file.arrayBuffer().then((bytes) => worker.postMessage({ bytes }, [bytes]));
  }, []);

  useEffect(() => {
    if (!replay || !playing) return;
    let last = performance.now();
    let id = 0;
    const max =
      replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0;
    const tps = tickRate(replay);
    const min = replay.ticks.ticks[0] ?? 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tickRef.current += dt * tps * speed;
      if (tickRef.current >= max) {
        tickRef.current = max;
        setTick(max);
        setPlaying(false);
        return;
      }
      if (tickRef.current <= min) {
        tickRef.current = min;
        setTick(min);
        if (speed < 0) {
          setPlaying(false);
          return;
        }
      }
      setTick(tickRef.current);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [replay, playing, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const r = replayRef.current;
      if (!r) return;
      const round = currentRound(r, tickRef.current);
      const roundIdx = r.rounds.findIndex((x) => x.start_tick === round?.start_tick);
      const min = r.ticks.ticks[0] ?? 0;
      const max = r.header.playback_ticks || r.ticks.ticks[r.ticks.ticks.length - 1] || 0;
      const kills = r.kills.map((k) => k.tick);

      if (e.code === "Space") {
        e.preventDefault();
        setPlaying(!playingRef.current);
        return;
      }
      if (e.key === "[" || e.key === "]") {
        const n = r.rounds[roundIdx + (e.key === "]" ? 1 : -1)];
        if (n) jump(n.freeze_end_tick || n.start_tick);
        return;
      }
      if (e.key === "," || e.key === ".") {
        const t = nextEventTick(kills, tickRef.current, e.key === "." ? 1 : -1);
        if (t != null) jump(t);
        return;
      }
      if (e.key === "e" || e.key === "E") {
        const t = nextExecuteTick(findExecutes(r), tickRef.current, e.key === "E" ? -1 : 1);
        if (t != null) jump(t);
        return;
      }
      if (e.key === "Home") {
        jump(round?.freeze_end_tick || round?.start_tick || min);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (selectedRef.current != null) setFollow((v) => !v);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        setTrails((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setSelected(null);
        setFollow(false);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 64 : 16;
        jump(
          Math.min(max, Math.max(min, tickRef.current + (e.key === "ArrowRight" ? step : -step))),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

  const cal = replay ? calibrationFor(maps, replay.header.map_name) : undefined;

  if (!replay) {
    return (
      <div className="app splash">
        <DropZone onFile={onFile} parsing={parsing} progress={progress} error={error} />
      </div>
    );
  }

  const downloadCsv = () => {
    const stats = computeStats(replay, tick);
    const blob = new Blob([exportStatsCsv(replay, stats, tick)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.dem$/i, "") || "demo"}-stats.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="app">
      <header className="top">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setReplay(null);
            setPlaying(false);
          }}
        >
          New demo
        </button>
        <div className="brand">
          <img
            className="brand-mark"
            src={publicUrl("favicon.svg")}
            width={28}
            height={28}
            alt=""
          />
          <h1>CS2 Analyzer</h1>
        </div>
        <span className="file-meta">
          {prettyMap(replay.header.map_name)}
          {fileName ? ` · ${fileName}` : ""} · {replay.kills.length} kills ·{" "}
          {replay.grenades.length} nades
        </span>
        <button type="button" className="ghost" onClick={downloadCsv}>
          Export CSV
        </button>
      </header>
      <main className="stage">
        <div className="radar-col">
          <MapToolbar
            tool={tool}
            color={color}
            follow={follow}
            trails={trails}
            canFollow={selected != null}
            layers={layers}
            onTool={setTool}
            onColor={setColor}
            onFollow={setFollow}
            onTrails={setTrails}
            onLayers={setLayers}
            onClear={() => setStrokes([])}
            onResetView={() => setViewEpoch((n) => n + 1)}
          />
          <div className="radar-stage">
            <RadarCanvas
              replay={replay}
              tick={tick}
              cal={cal}
              selected={selected}
              onSelect={(i) => {
                setSelected(i);
                setFollow(i != null);
              }}
              follow={follow}
              trails={trails}
              tool={tool}
              color={color}
              strokes={strokes}
              onStrokes={setStrokes}
              onPan={() => setFollow(false)}
              layers={layers}
              viewEpoch={viewEpoch}
            />
            <Hud replay={replay} tick={tick} />
            <SpectatorEconomy
              replay={replay}
              tick={tick}
              selected={selected}
              onSelect={(i) => {
                setSelected(i);
                setFollow(i != null);
              }}
            />
            <KillFeed replay={replay} tick={tick} onJump={jump} />
          </div>
        </div>
        <Sidebar
          replay={replay}
          tick={tick}
          selected={selected}
          onSelect={(i) => {
            setSelected(i);
            setFollow(i != null);
          }}
          onJump={jump}
        />
      </main>
      <RoundStrip replay={replay} tick={tick} onJump={jump} />
      <Controls
        replay={replay}
        tick={tick}
        playing={playing}
        speed={speed}
        onTick={(t) => {
          tickRef.current = t;
          setTick(t);
        }}
        onPlaying={setPlaying}
        onSpeed={setSpeed}
      />
      <p className="keys">
        Space play · ←/→ scrub · [ ] rounds · e E executes · , . kills · F track · T trail · Esc
        deselect
      </p>
    </div>
  );
}
