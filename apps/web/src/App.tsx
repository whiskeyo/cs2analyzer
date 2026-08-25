import { DRAW_HISTORY_LIMIT, PROJECT_SAVE_DEBOUNCE_MS } from "./constants";
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
import {
  defaultColor,
  defaultPaletteId,
  deleteProject,
  importProjects,
  isNotesFile,
  loadAllProjects,
  loadProject,
  matchKey,
  parseBundle,
  PROJECT_SCHEMA,
  saveProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";
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
  type FloorMode,
  type MapCalibration,
  type MapLayers,
  type Replay,
  type Stroke,
  type SummaryFilter,
  type WorkerOut,
} from "./types";
import { publicUrl } from "./publicUrl";
import { NADE_COLORS } from "./radarFx";
import { prettyMap } from "./weapons";
import { usePlayback } from "./usePlayback";

function downloadJson(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function App() {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<ReviewProject[]>([]);
  const { tick, setTick, tickRef, playing, setPlaying, playingRef, speed, setSpeed, jump } =
    usePlayback(replay);
  const [selected, setSelected] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [trails, setTrails] = useState(false);
  const [moment, setMoment] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pan");
  const [paletteId, setPaletteId] = useState(defaultPaletteId);
  const [color, setColor] = useState(defaultColor);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(DEFAULT_SUMMARY_FILTER);
  const [floorMode, setFloorMode] = useState<FloorMode>("auto");
  const [viewEpoch, setViewEpoch] = useState(0);
  const [maps, setMaps] = useState<Record<string, MapCalibration>>({});
  const workerRef = useRef<Worker | null>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const historyRef = useRef<Stroke[][]>([[]]);
  const histIdxRef = useRef(0);
  const fileNameRef = useRef(fileName);
  fileNameRef.current = fileName;
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const overlayRef = useRef({ summaryFilter, floorMode, paletteId, color });
  overlayRef.current = { summaryFilter, floorMode, paletteId, color };

  const refreshSaved = useCallback(() => {
    void loadAllProjects()
      .then((list) => {
        list.sort((a, b) => b.savedAt - a.savedAt);
        setSaved(list);
      })
      .catch(() => undefined);
  }, []);

  const syncHistoryButtons = () => {
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  };

  const commitStrokes = useCallback((next: Stroke[], reset = false) => {
    if (reset) {
      historyRef.current = [next];
      histIdxRef.current = 0;
    } else {
      const trimmed = historyRef.current.slice(0, histIdxRef.current + 1);
      trimmed.push(next);
      if (trimmed.length > DRAW_HISTORY_LIMIT) trimmed.shift();
      historyRef.current = trimmed;
      histIdxRef.current = trimmed.length - 1;
    }
    setStrokes(next);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current -= 1;
    setStrokes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current += 1;
    setStrokes(historyRef.current[histIdxRef.current] ?? []);
    syncHistoryButtons();
  }, []);

  const applyProject = useCallback(
    (p: ReviewProject, jumpTick: boolean) => {
      commitStrokes(p.strokes, true);
      setSummaryFilter(p.summaryFilter);
      setFloorMode(p.floorMode);
      setPaletteId(p.paletteId);
      setColor(p.color);
      if (jumpTick && p.tick > 0) jump(p.tick, true);
    },
    [commitStrokes, jump],
  );

  const exportNotes = useCallback(async () => {
    try {
      const projects = await loadAllProjects();
      if (projects.length === 0) {
        setNotice("No saved notes in this browser yet.");
        return;
      }
      downloadJson("cs2analyzer-notes.json", serializeBundle(projects));
      setNotice(`Exported ${projects.length} saved match${projects.length === 1 ? "" : "es"}.`);
    } catch {
      setError("Could not export notes.");
    }
  }, []);

  const importNotesText = useCallback(
    async (text: string) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        setError("Notes file is not valid JSON.");
        return;
      }
      const bundle = parseBundle(raw);
      if (!bundle || bundle.projects.length === 0) {
        setError("Notes file has no valid reviews.");
        return;
      }
      const n = await importProjects(bundle);
      refreshSaved();
      setError(null);
      setNotice(
        `Imported ${n} saved match${n === 1 ? "" : "es"}. Drop the demo to restore drawings.`,
      );
      const r = replayRef.current;
      if (!r) return;
      const key = matchKey(r, fileNameRef.current);
      const mine = bundle.projects.find((p) => p.key === key);
      if (mine) applyProject(mine, false);
    },
    [applyProject, refreshSaved],
  );

  const persistNow = useCallback(() => {
    const r = replayRef.current;
    if (!r) return Promise.resolve();
    const overlay = overlayRef.current;
    return saveProject({
      schema: PROJECT_SCHEMA,
      key: matchKey(r, fileNameRef.current),
      savedAt: Date.now(),
      fileName: fileNameRef.current,
      mapName: r.header.map_name,
      tick: tickRef.current,
      strokes: strokesRef.current,
      summaryFilter: overlay.summaryFilter,
      floorMode: overlay.floorMode,
      paletteId: overlay.paletteId,
      color: overlay.color,
    })
      .then(refreshSaved)
      .catch(() => undefined);
  }, [refreshSaved, tickRef]);

  useEffect(() => {
    loadCalibrations()
      .then(setMaps)
      .catch(() => undefined);
    refreshSaved();
  }, [refreshSaved]);

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
    [applyProject, commitStrokes, importNotesText, persistNow, setPlaying, setTick, tickRef],
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

  useEffect(() => {
    if (!replay) return;
    const id = window.setTimeout(() => {
      void persistNow();
    }, PROJECT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [replay, strokes, summaryFilter, floorMode, paletteId, color, playing, persistNow]);

  useEffect(() => {
    const onUnload = () => {
      void persistNow();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [persistNow]);

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
