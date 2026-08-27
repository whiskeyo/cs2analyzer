import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isNotesFile } from "@/lib/notes/projectStore";
import { useReviewProject, type ReviewStore } from "@/lib/notes/useReviewProject";
import { useDemoSession, type CreateWorker, type DemoSession } from "@/lib/parse/useDemoSession";
import { useHotkeys } from "@/lib/playback/useHotkeys";
import { usePlayback, type Playback } from "@/lib/playback/usePlayback";
import { calibrationFor, loadCalibrations } from "@/lib/radar/maps";
import { loadMapLayout, mapKey, type MapLayout } from "@/lib/radar/layouts";
import type { MapPlaces } from "@/lib/match/sites";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { useStatus, type Status } from "./status";
import { useViewState, type ViewState } from "./viewState";

export interface AppState {
  status: Status;
  session: DemoSession;
  playback: Playback;
  review: ReviewStore;
  view: ViewState;
  /** Radar calibration for the loaded map, or undefined until it is fetched. */
  cal: MapCalibration | undefined;
  /** Callout layout for the loaded map. Null when the map has no callouts. */
  places: MapPlaces | null;
  /** Routes a dropped file to the parser or the notes importer. */
  onFile: (file: File) => void;
}

const AppStateContext = createContext<AppState | null>(null);

/**
 * Composition root for the viewer's state. Four stores own their own slice and
 * only talk to each other through the arguments below, which keeps each one
 * testable on its own and mirrors the "UI-agnostic playback model" in
 * `docs/frontend-migration.md`.
 */
function useAppState(createWorker?: CreateWorker): AppState {
  const status = useStatus();
  const session = useDemoSession({ status, createWorker });
  const playback = usePlayback(session.replay);
  const review = useReviewProject({ demo: session.demo, status, playback });
  const view = useViewState(session.demo?.id ?? null);

  const [maps, setMaps] = useState<Record<string, MapCalibration>>({});
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const { replay } = session;

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
    setFollow: view.setFollow,
    setTrails: view.setTrails,
    setSelected: view.setSelected,
  });

  const onFile = (file: File) => {
    if (isNotesFile(file)) {
      void file.text().then((text) => void review.importNotesText(text));
      return;
    }
    session.parseDemo(file);
  };

  return { status, session, playback, review, view, cal, places, onFile };
}

export function AppStateProvider({
  children,
  createWorker,
}: {
  children: ReactNode;
  createWorker?: CreateWorker;
}) {
  const state = useAppState(createWorker);
  return <AppStateContext.Provider value={state}>{children}</AppStateContext.Provider>;
}

export function useApp(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useApp must be used inside <AppStateProvider>");
  return state;
}
