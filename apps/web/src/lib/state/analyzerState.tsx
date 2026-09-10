import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReviewProject, type ReviewStore } from "@/lib/notes/useReviewProject";
import { isBucketOverlayActive } from "@/lib/parse/seriesMode";
import { useHotkeys } from "@/lib/playback/useHotkeys";
import { PlaybackCommandProvider } from "@/lib/playback/playbackCommandContext";
import { createPlaybackCommandBus } from "@/lib/playback/playbackCommands";
import { usePlayback as usePlaybackClock, type Playback } from "@/lib/playback/usePlayback";
import { calibrationFor, loadCalibrations } from "@/lib/radar/maps";
import { loadMapLayout, mapKey, type MapLayout } from "@/lib/radar/layouts";
import type { MapPlaces } from "@/lib/match/sites";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { usePlayerSync } from "./usePlayerSync";
import { useSession } from "./sessionState";
import { useSeriesHabits, type SeriesHabitsState } from "./useSeriesHabits";
import { useViewState, type ViewState } from "./viewState";

export interface AnalyzerState {
  playback: Playback;
  review: ReviewStore;
  view: ViewState;
  habits: SeriesHabitsState;
  cal: MapCalibration | undefined;
  places: MapPlaces | null;
}

const AnalyzerContext = createContext<AnalyzerState | null>(null);

function AnalyzerRuntime({ children }: { children: ReactNode }) {
  const { status, session, bridgeRef } = useSession();
  const commandBus = useRef(createPlaybackCommandBus()).current;
  const bucketTransportRef = useRef(false);
  const playback = usePlaybackClock(session.replay, session.demo?.id ?? null, bucketTransportRef);
  const review = useReviewProject({
    demo: session.demo,
    series: session.series,
    parsedDemos: session.parsedDemos,
    status,
    playback,
  });
  const view = useViewState(session.demo?.id ?? null);

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

  const habits = useSeriesHabits({
    series: session.series,
    places,
    activeDemoId: session.demo?.id ?? null,
    selectDemo: session.selectDemo,
    jump: playback.jump,
  });

  bucketTransportRef.current = isBucketOverlayActive(session.series, habits);

  usePlayerSync({
    series: session.series,
    replay: session.replay,
    activeDemoId: session.demo?.id ?? null,
    tick: playback.tick,
    selected: view.selected,
    select: view.select,
    playerKey: habits.playerKey,
    setPlayerKey: habits.setPlayerKey,
    setFocalTeam: session.setFocalTeam,
  });

  const placesRef = useRef(places);
  placesRef.current = places;
  const replayRef = useRef(replay);
  replayRef.current = replay;

  useHotkeys({
    replayRef,
    placesRef,
    tickRef: playback.tickRef,
    playingRef: playback.playingRef,
    selectedRef: view.selectedRef,
    jump: playback.jump,
    undo: review.undo,
    redo: review.redo,
    setPlaying: playback.setPlaying,
    togglePlaying: playback.togglePlaying,
    setFollow: view.setFollow,
    setTrails: view.setTrails,
    setSelected: view.setSelected,
  });

  const value = useMemo(
    (): AnalyzerState => ({ playback, review, view, habits, cal, places }),
    [playback, review, view, habits, cal, places],
  );

  return (
    <PlaybackCommandProvider bus={commandBus}>
      <AnalyzerContext.Provider value={value}>{children}</AnalyzerContext.Provider>
    </PlaybackCommandProvider>
  );
}

/** Mounts playback/review/hotkeys only while a demo is parsing or loaded. */
export function AnalyzerHost({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const active = session.demo != null || session.parsing || session.replay != null;
  if (!active) return children;
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

export function useReview(): ReviewStore {
  return useAnalyzer().review;
}
