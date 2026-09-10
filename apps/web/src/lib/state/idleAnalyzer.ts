import { defaultColor, defaultPaletteId } from "@/lib/notes/projectStore";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import type { ReviewSession } from "@/lib/notes/useReviewProject";
import { DEFAULT_HABITS_NADE_FILTER } from "@/lib/parse/seriesOverlay";
import type { Playback } from "@/lib/playback/usePlayback";
import type { SeriesHabitsState } from "./useSeriesHabits";
import type { ViewState } from "./viewState";

const noop = () => undefined;

/** Fills `useApp()` when FAQ/Playbook/Home run without AnalyzerProvider. */
export function idlePlayback(): Playback {
  return {
    tick: 0,
    tickRef: { current: 0 },
    playing: false,
    setPlaying: noop,
    togglePlaying: noop,
    playingRef: { current: false },
    speed: 1,
    setSpeed: noop,
    roundAutoplay: false,
    setRoundAutoplay: noop,
    jump: noop,
    scrub: noop,
    pauseNow: noop,
    activeRound: null,
  };
}

export function idleView(): ViewState {
  return {
    selected: null,
    selectedRef: { current: null },
    select: noop,
    setSelected: noop,
    follow: false,
    setFollow: noop,
    trails: false,
    setTrails: noop,
    moment: false,
    setMoment: noop,
    tool: "pan",
    setTool: noop,
    layers: DEFAULT_LAYERS,
    setLayers: noop,
    viewEpoch: 0,
    resetView: noop,
  };
}

export function idleHabits(): SeriesHabitsState {
  return {
    filter: { side: "CT", kind: "full", playerKey: null },
    playerKey: null,
    setSide: noop,
    setKind: noop,
    setPlayerKey: noop,
    seriesView: "demos",
    setSeriesView: noop,
    aggregated: false,
    overlayOn: false,
    setOverlayOn: noop,
    bucketOverlay: null,
    selectBucketOverlay: noop,
    bucketPlaySec: 0,
    bucketPlaySecRef: { current: 0 },
    setBucketPlaySec: noop,
    bucketWindowSec: 0,
    overlayDisplay: "trails",
    setOverlayDisplay: noop,
    overlayTrails: false,
    setOverlayTrails: noop,
    overlayArrows: true,
    setOverlayArrows: noop,
    nadeFilter: DEFAULT_HABITS_NADE_FILTER,
    setNadeKind: noop,
    nadesOn: false,
    setNadesOn: noop,
    nadeOpacity: 0.4,
    setNadeOpacity: noop,
    bucketFilter: { side: "CT", kind: "full" },
    overlay: null,
    util: null,
    action: null,
    utilSets: null,
    seriesUtilThrows: [],
    seriesActionBeats: [],
    seriesRoundsByKind: [],
    demoColors: new Map(),
    focalPlayers: [],
    playRound: noop,
  };
}

export function idleReview(partial: Partial<ReviewSession> = {}): ReviewSession {
  return {
    saved: [],
    notes: [],
    notesRef: { current: [] },
    canUndo: false,
    canRedo: false,
    paletteId: defaultPaletteId(),
    setPaletteId: noop,
    color: defaultColor(),
    setColor: noop,
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    setSummaryFilter: noop,
    floorMode: "auto",
    setFloorMode: noop,
    refreshSaved: noop,
    commitNotes: noop,
    undo: noop,
    redo: noop,
    applyProject: noop,
    exportNotes: async () => undefined,
    importNotesText: async () => undefined,
    removeAllNotes: async () => undefined,
    persistNow: async () => undefined,
    stashForSeriesSwitch: noop,
    tryOpenSaved: async () => null,
    linkDemoFile: async () => undefined,
    ...partial,
  };
}
