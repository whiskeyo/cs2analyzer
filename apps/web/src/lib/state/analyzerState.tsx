import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReviewProject, type ReviewSession } from "@/lib/notes/useReviewProject";
import { analyzerNotesLive } from "@/lib/notes";
import { isAggregatedView, isBucketOverlayActive } from "@/lib/parse/seriesMode";
import { useBucketTransport } from "@/lib/playback/useBucketTransport";
import { useHotkeys } from "@/lib/playback/useHotkeys";
import { PlaybackCommandProvider } from "@/lib/playback/playbackCommandContext";
import { createPlaybackCommandBus } from "@/lib/playback/playbackCommands";
import { usePlayback as usePlaybackClock, type Playback } from "@/lib/playback/usePlayback";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { calibrationFor, loadCalibrations } from "@/lib/radar/maps";
import { loadMapLayout, mapKey, type MapLayout } from "@/lib/radar/layouts";
import type { MapPlaces } from "@/lib/match/sites";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { tutorialLocksSeriesToAggregatedFull } from "@/lib/tutorial/activeRound";
import { habitsKeyPatch, radarSelectPatch } from "./playerSelection";
import { usePlayerSync } from "./usePlayerSync";
import { useSession } from "./sessionState";
import { useSeriesHabits, type SeriesHabitsState } from "./useSeriesHabits";
import { useViewState, type ViewState } from "./viewState";

export interface AnalyzerState {
  playback: Playback;
  review: ReviewSession;
  view: ViewState;
  habits: SeriesHabitsState;
  cal: MapCalibration | undefined;
  places: MapPlaces | null;
}

const AnalyzerContext = createContext<AnalyzerState | null>(null);

/** Owns the per-demo command bus. Playback hooks must run under this provider. */
function AnalyzerRuntime({ children }: { children: ReactNode }) {
  const commandBus = useRef(createPlaybackCommandBus()).current;
  return (
    <PlaybackCommandProvider bus={commandBus}>
      <AnalyzerPlayback>{children}</AnalyzerPlayback>
    </PlaybackCommandProvider>
  );
}

function AnalyzerPlayback({ children }: { children: ReactNode }) {
  const { status, session, notes, bridgeRef } = useSession();
  const { settings } = useUserSettings();
  const bucketTransportRef = useRef(false);
  const playback = usePlaybackClock(
    session.replay,
    session.demo?.id ?? null,
    bucketTransportRef,
    settings.defaultPlaybackSpeed,
    settings.skipKnifeOnOpen,
  );
  const review = useReviewProject({
    demo: session.demo,
    series: session.series,
    parsedDemos: session.parsedDemos,
    status,
    playback,
    saved: notes.saved,
    refreshSaved: notes.refreshSaved,
    overlayDefaults: {
      paletteId: settings.defaultPaletteId,
      color: settings.defaultColor,
      floorMode: settings.defaultFloorMode,
      summaryFilter: {
        ...settings.defaultSummaryFilter,
        kinds: { ...settings.defaultSummaryFilter.kinds },
      },
    },
  });
  const view = useViewState(
    session.demo?.id ?? null,
    settings.defaultLayers,
    settings.defaultDrawTool,
  );

  const [maps, setMaps] = useState<Record<string, MapCalibration>>({});
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const { replay } = session;

  useLayoutEffect(() => {
    const bridge = bridgeRef.current;
    bridge.pausePlayback = playback.pauseNow;
    bridge.stashSeriesReview = review.stashForSeriesSwitch;
    bridge.importNotesText = review.importNotesText;
    return () => {
      bridge.pausePlayback = () => undefined;
      bridge.stashSeriesReview = () => undefined;
      bridge.importNotesText = null;
    };
  }, [bridgeRef, playback.pauseNow, review.importNotesText, review.stashForSeriesSwitch]);

  useEffect(() => {
    loadCalibrations()
      .then(setMaps)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!replay) return;
    let cancelled = false;
    loadMapLayout(replay.header.map_name)
      .then((next) => {
        if (!cancelled) setLayout(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [replay]);

  const cal = replay ? calibrationFor(maps, replay.header.map_name) : undefined;
  const places = useMemo((): MapPlaces | null => {
    if (!replay || !cal || !layout || layout.callouts.length === 0) return null;
    if (layout.map !== mapKey(replay.header.map_name)) return null;
    return { layout, cal };
  }, [replay, cal, layout]);

  const jump = useCallback<Playback["jump"]>(
    (t, pause, round) => {
      if (tutorialLocksSeriesToAggregatedFull(session.series)) return;
      playback.jump(t, pause, round);
    },
    [playback, session.series],
  );

  const habits = useSeriesHabits({
    series: session.series,
    places,
    activeDemoId: session.demo?.id ?? null,
    selectDemo: session.selectDemo,
    jump,
    trailWindowSec: settings.habitsTrailWindowSec,
    pathBranchMergeDistance: settings.pathBranchMergeDistance,
    pathBranchStepDistance: settings.pathBranchStepDistance,
    pathBranchMinShare: settings.pathBranchMinShare,
  });

  const bucketActive = isBucketOverlayActive(session.series, habits);
  useLayoutEffect(() => {
    bucketTransportRef.current = bucketActive;
  }, [bucketActive]);
  useBucketTransport({
    active: bucketActive,
    playing: playback.playing,
    speed: playback.speed,
    setPlaying: playback.setPlaying,
    bucketWindowSec: habits.bucketWindowSec,
    bucketPlaySecRef: habits.bucketPlaySecRef,
    setBucketPlaySec: habits.setBucketPlaySec,
  });

  usePlayerSync({
    series: session.series,
    replay: session.replay,
    activeDemoId: session.demo?.id ?? null,
    setSelected: view.setSelected,
    playerKey: habits.playerKey,
  });

  const select = useCallback(
    (index: number | null) => {
      const patch = radarSelectPatch({
        index,
        series: session.series,
        replay: session.replay,
        tick: playback.tickRef.current,
      });
      view.select(patch.selected);
      if (patch.playerKey !== undefined) habits.setPlayerKey(patch.playerKey);
      if (patch.focalTeam) session.setFocalTeam(patch.focalTeam);
    },
    [habits, playback.tickRef, session, view],
  );

  const setPlayerKey = useCallback(
    (key: string | null) => {
      const patch = habitsKeyPatch({ playerKey: key, replay: session.replay });
      habits.setPlayerKey(patch.playerKey);
      view.select(patch.selected);
    },
    [habits, session.replay, view],
  );

  const viewOut = useMemo(
    (): ViewState => ({ ...view, select, setSelected: select }),
    [view, select],
  );
  const habitsOut = useMemo(
    (): SeriesHabitsState => ({ ...habits, setPlayerKey }),
    [habits, setPlayerKey],
  );

  const placesRef = useRef(places);
  placesRef.current = places;
  const replayRef = useRef(replay);
  replayRef.current = replay;

  const notesLive = analyzerNotesLive({
    aggregated: isAggregatedView(session.series, habits),
    notesDemoId: review.notesDemoId ?? null,
    boardDemoId: session.demo?.id ?? null,
  });
  useHotkeys({
    replayRef,
    placesRef,
    tickRef: playback.tickRef,
    playingRef: playback.playingRef,
    selectedRef: view.selectedRef,
    jump,
    undo: notesLive ? review.undo : () => undefined,
    redo: notesLive ? review.redo : () => undefined,
    setPlaying: playback.setPlaying,
    togglePlaying: playback.togglePlaying,
    setFollow: view.setFollow,
    setTrails: view.setTrails,
    setSelected: select,
  });

  const playbackOut = useMemo((): Playback => ({ ...playback, jump }), [playback, jump]);
  const value = useMemo(
    (): AnalyzerState => ({
      playback: playbackOut,
      review,
      view: viewOut,
      habits: habitsOut,
      cal,
      places,
    }),
    [playbackOut, review, viewOut, habitsOut, cal, places],
  );

  return <AnalyzerContext.Provider value={value}>{children}</AnalyzerContext.Provider>;
}

/** Mounts playback/review/hotkeys only while a demo is parsing or loaded. */
export function AnalyzerHost({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { ready } = useUserSettings();
  const active = session.demo != null || session.parsing || session.replay != null;
  if (!ready || !active) return children;
  return <AnalyzerRuntime>{children}</AnalyzerRuntime>;
}

export function useOptionalAnalyzer(): AnalyzerState | null {
  return useContext(AnalyzerContext);
}

export function useAnalyzer(): AnalyzerState {
  const state = useOptionalAnalyzer();
  if (!state) throw new Error("useAnalyzer must be used inside <AnalyzerProvider>");
  return state;
}

export function usePlayback(): Playback {
  return useAnalyzer().playback;
}

export function useReview(): ReviewSession {
  return useAnalyzer().review;
}
