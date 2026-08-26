import { useEffect, useMemo, useRef, useState } from "react";
import { tickRate } from "@/lib/shared/constants";
import { Controls } from "@/components/playback/Controls";
import { DropZone } from "./DropZone";
import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { Hud } from "@/components/radar/Hud";
import { KillFeed } from "@/components/radar/KillFeed";
import { SpectatorEconomy } from "@/components/radar/SpectatorEconomy";
import { MapToolbar } from "@/components/radar/MapToolbar";
import { calibrationFor, loadCalibrations } from "@/lib/radar/maps";
import { loadMapLayout, mapKey, type MapLayout } from "@/lib/radar/layouts";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { deleteProject } from "@/lib/notes/projectStore";
import { RadarCanvas } from "@/components/radar/RadarCanvas";
import { RoundStrip } from "@/components/playback/RoundStrip";
import { currentRound } from "@/lib/replay/sample";
import { makeBookmarkStroke } from "@/lib/notes";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { computeStats, exportStatsCsv } from "@/lib/stats/stats";
import { type MapCalibration, type Replay } from "@/lib/replay/replayTypes";
import type { MapPlaces } from "@/lib/match/sites";
import { DEFAULT_LAYERS, type DrawTool, type MapLayers } from "@/lib/notes/types";
import { publicUrl } from "@/lib/shared/publicUrl";
import { NADE_COLORS } from "@/lib/radar/radarFx";
import { prettyMap } from "@/lib/weapons/weapons";
import { useDemoParse } from "@/lib/parse/useDemoParse";
import { useHotkeys } from "@/lib/playback/useHotkeys";
import { usePlayback } from "@/lib/playback/usePlayback";
import { useReviewProject } from "@/lib/notes/useReviewProject";

export function App() {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [fileName, setFileName] = useState("");
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
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const placesRef = useRef<MapPlaces | null>(null);
  const { parsing, progress, onFile } = useDemoParse({
    persistNow,
    importNotesText,
    commitStrokes,
    applyProject,
    jump,
    setReplay,
    setFileName,
    setFollow,
    setSelected,
    setLayers,
    setSummaryFilter,
    setFloorMode,
    setError,
    setNotice,
    setPlaying,
    setTick,
    tickRef,
  });
  useHotkeys({
    replayRef,
    tickRef,
    playingRef,
    selectedRef,
    jump,
    undo,
    redo,
    setPlaying,
    setFollow,
    setTrails,
    setSelected,
    placesRef,
  });

  useEffect(() => {
    loadCalibrations()
      .then(setMaps)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!replay) return;
    let cancel = false;
    loadMapLayout(replay.header.map_name)
      .then((next) => {
        if (!cancel) setLayout(next);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [replay]);

  const cal = replay ? calibrationFor(maps, replay.header.map_name) : undefined;
  const places = useMemo((): MapPlaces | null => {
    if (!replay || !cal || !layout || layout.callouts.length === 0) return null;
    if (layout.map !== mapKey(replay.header.map_name)) return null;
    return { layout, cal };
  }, [replay, cal, layout]);
  placesRef.current = places;

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
              commitStrokes(
                round == null
                  ? []
                  : strokes.filter((st) => st.round !== round || st.type === "bookmark"),
              );
            }}
            onResetView={() => setViewEpoch((n) => n + 1)}
            onStampBookmark={() => {
              const rnd = currentRound(replay, tick);
              if (!rnd) return;
              commitStrokes([
                ...strokes,
                makeBookmarkStroke(color, rnd.number, tick, moment, rnd.end_tick, tickRate(replay)),
              ]);
            }}
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
          places={places}
        />
      </main>
      <RoundStrip replay={replay} tick={tick} strokes={strokes} onJump={jump} places={places} />
      <Controls
        replay={replay}
        tick={tick}
        strokes={strokes}
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
