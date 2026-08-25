import { roundScrubRange } from "./roundTimeline";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controls } from "./Controls";
import { DropZone } from "./DropZone";
import { ImportNotesButton } from "./ImportNotesButton";
import { Hud } from "./Hud";
import { KillFeed } from "./KillFeed";
import { SpectatorEconomy } from "./SpectatorEconomy";
import { MapToolbar } from "./MapToolbar";
import { calibrationFor, loadCalibrations } from "./maps";
import { COLOR_PRESETS } from "./palettes";
import { deleteProject, isNotesFile, loadProject, matchKey } from "./projectStore";
import { RadarCanvas } from "./RadarCanvas";
import { RoundStrip } from "./RoundStrip";
import { findExecutes, nextExecuteTick } from "./execute";
import { currentRound } from "./sample";
import { Sidebar } from "./Sidebar";
import { computeStats, exportStatsCsv, nextEventTick } from "./stats";
import {
  DEFAULT_LAYERS,
  DEFAULT_SUMMARY_FILTER,
  type DrawTool,
  type MapCalibration,
  type MapLayers,
  type Replay,
  type WorkerOut,
} from "./types";
import { publicUrl } from "./publicUrl";
import { NADE_COLORS } from "./radarFx";
import { prettyMap } from "./weapons";
import { usePlayback } from "./usePlayback";
import { useReviewProject } from "./useReviewProject";

export function App() {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { tick, setTick, tickRef, playing, setPlaying, playingRef, speed, setSpeed, jump } =
    usePlayback(replay);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const fileNameRef = useRef(fileName);
  fileNameRef.current = fileName;
  const review = useReviewProject({
    replay,
    playing,
    replayRef,
    fileNameRef,
    tickRef,
    jump,
  });
  const {
    saved,
    strokes,
    canUndo,
    canRedo,
    error,
    setError,
    notice,
    setNotice,
    paletteId,
    setPaletteId,
    color,
    setColor,
    summaryFilter,
    setSummaryFilter,
    floorMode,
    setFloorMode,
    refreshSaved,
    commitStrokes,
    undo,
    redo,
    applyProject,
    exportNotes,
    importNotesText,
    persistNow,
  } = review;
  const [selected, setSelected] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [trails, setTrails] = useState(false);
  const [moment, setMoment] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pan");
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [viewEpoch, setViewEpoch] = useState(0);
  const [maps, setMaps] = useState<Record<string, MapCalibration>>({});
  const workerRef = useRef<Worker | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    loadCalibrations()
      .then(setMaps)
      .catch(() => undefined);
  }, []);

  const onFile = useCallback(
    (file: File) => {
      if (isNotesFile(file)) {
        void file.text().then((text) => importNotesText(text));
        return;
      }
      void persistNow();
      setError(null);
      setNotice(null);
      setParsing(true);
      setProgress({ current: 0, total: 1 });
      setReplay(null);
      setFileName(file.name);
      commitStrokes([], true);
      setFollow(false);
      setSelected(null);
      setLayers(DEFAULT_LAYERS);
      setSummaryFilter(DEFAULT_SUMMARY_FILTER);
      setFloorMode("auto");
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
          setParsing(false);
          worker.terminate();
          void loadProject(matchKey(msg.replay, file.name))
            .then((p) => {
              if (p) {
                applyProject(p, true);
                setPlaying(false);
                setNotice("Restored drawings for this match.");
              } else {
                setPlaying(true);
              }
            })
            .catch(() => setPlaying(true));
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
    },
    [
      applyProject,
      commitStrokes,
      importNotesText,
      persistNow,
      setError,
      setFloorMode,
      setNotice,
      setPlaying,
      setSummaryFilter,
      setTick,
      tickRef,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement | null)?.closest?.(".radar-text-edit")) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      const r = replayRef.current;
      if (!r) return;
      const round = currentRound(r, tickRef.current);
      const roundIdx = r.rounds.findIndex((x) => x.start_tick === round?.start_tick);
      const fallback = {
        min: r.ticks.ticks[0] ?? 0,
        max: r.header.playback_ticks || r.ticks.ticks[r.ticks.ticks.length - 1] || 0,
      };
      const { min, max } = roundScrubRange(round ?? undefined, r.rounds, fallback);
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
  }, [jump, redo, undo, playingRef, setPlaying, tickRef]);

  const cal = replay ? calibrationFor(maps, replay.header.map_name) : undefined;

  if (!replay) {
    return (
      <div className="app splash">
        <DropZone
          onFile={onFile}
          onExportNotes={() => void exportNotes()}
          parsing={parsing}
          progress={progress}
          error={error}
          notice={notice}
          saved={saved}
          onDeleteNotes={(key) => {
            void deleteProject(key).then(refreshSaved);
          }}
          onWantDemo={(name) =>
            setNotice(`Drop ${name} to restore those notes. The demo itself is not stored.`)
          }
        />
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
            void persistNow();
            setReplay(null);
            setPlaying(false);
            refreshSaved();
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
        <button type="button" className="ghost" onClick={() => void exportNotes()}>
          Export notes
        </button>
        <ImportNotesButton onFile={onFile} />
        <button type="button" className="ghost" onClick={downloadCsv}>
          Export CSV
        </button>
      </header>
      <main className="stage">
        <div className="radar-col">
          <MapToolbar
            tool={tool}
            color={color}
            paletteId={paletteId}
            follow={follow}
            trails={trails}
            moment={moment}
            canFollow={selected != null}
            layers={layers}
            floorMode={floorMode}
            hasFloors={Boolean(cal?.lower_radar)}
            canUndo={canUndo}
            canRedo={canRedo}
            onTool={setTool}
            onColor={setColor}
            onPalette={(id) => {
              setPaletteId(id);
              const preset = COLOR_PRESETS.find((p) => p.id === id);
              if (preset && !(preset.colors as readonly string[]).includes(color)) {
                setColor(preset.colors[0]);
              }
            }}
            onFollow={setFollow}
            onTrails={setTrails}
            onMoment={setMoment}
            onLayers={(next) => {
              if (next.summary && !layers.summary) setPlaying(false);
              setLayers(next);
            }}
            onFloorMode={setFloorMode}
            onUndo={undo}
            onRedo={redo}
            onClear={() => {
              const round = currentRound(replay, tick)?.number;
              commitStrokes(round == null ? [] : strokes.filter((st) => st.round !== round));
            }}
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
              onStrokes={(next) => commitStrokes(next)}
              onPan={() => setFollow(false)}
              onPause={() => setPlaying(false)}
              moment={moment}
              layers={layers}
              summaryFilter={summaryFilter}
              viewEpoch={viewEpoch}
              floorMode={floorMode}
            />
            <Hud replay={replay} tick={tick} />
            {layers.summary && (
              <div className="nade-legend">
                <button
                  type="button"
                  className={summaryFilter.t ? "on" : ""}
                  onClick={() => setSummaryFilter((f) => ({ ...f, t: !f.t }))}
                >
                  T
                </button>
                <button
                  type="button"
                  className={summaryFilter.ct ? "on" : ""}
                  onClick={() => setSummaryFilter((f) => ({ ...f, ct: !f.ct }))}
                >
                  CT
                </button>
                {(
                  [
                    ["smoke", "Smoke"],
                    ["molotov", "Molly"],
                    ["flash", "Flash"],
                    ["he", "HE"],
                    ["decoy", "Decoy"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    className={summaryFilter.kinds[kind] ? "on" : ""}
                    onClick={() =>
                      setSummaryFilter((f) => ({
                        ...f,
                        kinds: { ...f.kinds, [kind]: !f.kinds[kind] },
                      }))
                    }
                  >
                    <i style={{ background: NADE_COLORS[kind] }} />
                    {label}
                  </button>
                ))}
              </div>
            )}
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
          strokes={strokes}
          selected={selected}
          onSelect={(i) => {
            setSelected(i);
            setFollow(i != null);
          }}
          onJump={jump}
          onStrokes={(next) => commitStrokes(next)}
        />
      </main>
      <RoundStrip replay={replay} tick={tick} strokes={strokes} onJump={jump} />
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
        Space play · ←/→ scrub · [ ] rounds · e E executes · , . kills · F track · T trail · Ctrl+Z
        undo · Esc deselect
      </p>
    </div>
  );
}
