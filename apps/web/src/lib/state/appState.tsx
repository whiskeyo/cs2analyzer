import type { ReactNode } from "react";
import type { ReviewSession } from "@/lib/notes/useReviewProject";
import type { CreateWorker, DemoSession } from "@/lib/parse/useDemoSession";
import type { MapPlaces } from "@/lib/match/sites";
import type { Playback } from "@/lib/playback/usePlayback";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import {
  AnalyzerHost,
  useAnalyzer,
  useOptionalAnalyzer,
  usePlayback,
  useReview,
  type AnalyzerState,
} from "./analyzerState";
import { idleHabits, idlePlayback, idleView } from "./idleAnalyzer";
import { SessionProvider, useSession, type SessionState } from "./sessionState";
import type { Status } from "./status";
import type { SeriesHabitsState } from "./useSeriesHabits";
import type { ViewState } from "./viewState";

const IDLE_PLAYBACK = idlePlayback();
const IDLE_VIEW = idleView();
const IDLE_HABITS = idleHabits();

export interface AppState {
  status: Status;
  session: DemoSession;
  playback: Playback;
  review: ReviewSession;
  view: ViewState;
  habits: SeriesHabitsState;
  /** Radar calibration for the loaded map, or undefined until it is fetched. */
  cal: MapCalibration | undefined;
  /** Callout layout for the loaded map. Null when the map has no callouts. */
  places: MapPlaces | null;
  /** Routes dropped demo(s) to the parser or a notes file to the importer. */
  onFiles: (files: File[]) => void;
  /** Add demo(s) to the open session (single→series or fold into a series). */
  appendFiles: (files: File[]) => void;
}

/**
 * Session at the root (Home drop, saved notes). AnalyzerRuntime — playback,
 * review history, habits, hotkeys, command sink — mounts only while a demo is
 * parsing or loaded, so FAQ/Playbook do not construct that graph on a cold visit.
 */
export function AppStateProvider({
  children,
  createWorker,
}: {
  children: ReactNode;
  createWorker?: CreateWorker;
}) {
  return (
    <UserSettingsProvider>
      <SessionProvider createWorker={createWorker}>
        <AnalyzerHost>{children}</AnalyzerHost>
      </SessionProvider>
    </UserSettingsProvider>
  );
}

export function useApp(): AppState {
  const { status, session, notes, onFiles, appendFiles } = useSession();
  const analyzer = useOptionalAnalyzer();
  return {
    status,
    session,
    onFiles,
    appendFiles,
    playback: analyzer?.playback ?? IDLE_PLAYBACK,
    review: analyzer?.review ?? notes,
    view: analyzer?.view ?? IDLE_VIEW,
    habits: analyzer?.habits ?? IDLE_HABITS,
    cal: analyzer?.cal,
    places: analyzer?.places ?? null,
  };
}

export { useAnalyzer, useOptionalAnalyzer, usePlayback, useReview, useSession };
export type { AnalyzerState, SessionState };
