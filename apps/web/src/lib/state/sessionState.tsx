import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { isNotesFile, loadAllProjects, type ReviewProject } from "@/lib/notes/projectStore";
import {
  exportSavedNotes,
  importNotesFromText,
  linkDemoFile,
  removeAllSavedNotes,
  tryOpenLinkedDemo,
} from "@/lib/notes/reviewImportExport";
import type { ReviewSession } from "@/lib/notes/useReviewProject";
import { useDemoSession, type CreateWorker, type DemoSession } from "@/lib/parse/useDemoSession";
import { useStatus, type Status } from "./status";
import { idleReview } from "./idleAnalyzer";

export interface AnalyzerBridge {
  pausePlayback: () => void;
  stashSeriesReview: () => void;
  importNotesText: ((text: string) => Promise<void>) | null;
}

export interface SessionState {
  status: Status;
  session: DemoSession;
  notes: ReviewSession;
  onFiles: (files: File[]) => void;
  bridgeRef: MutableRefObject<AnalyzerBridge>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Always-on shell: parse session, status, saved-notes list, and drop routing.
 * Playback / review history live in AnalyzerProvider and only mount with a demo.
 */
export function SessionProvider({
  children,
  createWorker,
}: {
  children: ReactNode;
  createWorker?: CreateWorker;
}) {
  const status = useStatus();
  const bridgeRef = useRef<AnalyzerBridge>({
    pausePlayback: () => undefined,
    stashSeriesReview: () => undefined,
    importNotesText: null,
  });
  const session = useDemoSession({
    status,
    createWorker,
    onBeforeSelectDemo: () => {
      bridgeRef.current.pausePlayback();
      bridgeRef.current.stashSeriesReview();
    },
  });
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statusRef = useRef(status);
  statusRef.current = status;

  const [saved, setSaved] = useState<ReviewProject[]>([]);

  const refreshSaved = useCallback(() => {
    void loadAllProjects()
      .then((list) => {
        list.sort((a, b) => b.savedAt - a.savedAt);
        setSaved(list);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const exportNotes = useCallback(async () => {
    await exportSavedNotes(loadAllProjects, statusRef.current);
  }, []);

  const removeAllNotes = useCallback(async () => {
    await removeAllSavedNotes(refreshSaved, statusRef.current);
  }, [refreshSaved]);

  const importNotesText = useCallback(
    async (text: string) => {
      const hosted = bridgeRef.current.importNotesText;
      if (hosted) {
        await hosted(text);
        return;
      }
      await importNotesFromText(text, {
        demo: sessionRef.current.demo,
        applyProject: () => undefined,
        refreshSaved,
        status: statusRef.current,
      });
    },
    [refreshSaved],
  );

  const tryOpenSaved = useCallback(
    async (project: ReviewProject) => tryOpenLinkedDemo(project, statusRef.current),
    [],
  );

  const linkDemoFileForProject = useCallback(
    async (project: ReviewProject) => {
      await linkDemoFile(project, refreshSaved, statusRef.current);
    },
    [refreshSaved],
  );

  const notes = useMemo(
    () =>
      idleReview({
        saved,
        refreshSaved,
        exportNotes,
        importNotesText,
        removeAllNotes,
        tryOpenSaved,
        linkDemoFile: linkDemoFileForProject,
      }),
    [
      saved,
      refreshSaved,
      exportNotes,
      importNotesText,
      removeAllNotes,
      tryOpenSaved,
      linkDemoFileForProject,
    ],
  );

  const onFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (files.length === 1 && isNotesFile(files[0])) {
        void files[0].text().then((text) => void importNotesText(text));
        return;
      }
      const demos = files.filter((f) => !isNotesFile(f));
      if (demos.length === 0) return;
      const current = sessionRef.current;
      if (demos.length === 1) current.parseDemo(demos[0]);
      else void current.parseDemos(demos);
    },
    [importNotesText],
  );

  const value = useMemo(
    (): SessionState => ({ status, session, notes, onFiles, bridgeRef }),
    [status, session, notes, onFiles],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (!state) throw new Error("useSession must be used inside <SessionProvider>");
  return state;
}
