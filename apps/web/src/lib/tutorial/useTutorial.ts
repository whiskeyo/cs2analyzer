import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";
import { isHomePath } from "@/lib/app/routes";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { purgeTutorialProjects } from "@/lib/notes/projectStore";
import { clearSeriesReviewCache } from "@/lib/notes/seriesReviewCache";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { useOptionalAnalyzer } from "@/lib/state/analyzerState";
import { useSession } from "@/lib/state/sessionState";
import { errorMessage } from "@/lib/validate/json.ts";
import { isTutorialDemoId, tutorialReplayDemo } from "./identity";
import {
  isTutorialSeriesReady,
  loadTutorialPlaybook,
  loadTutorialReplay,
  loadTutorialSeries,
} from "./load";
import {
  prefetchNextTutorialStep,
  scheduleHomeTutorialPrefetch,
  warmupTutorialSession,
} from "./prefetch";
import {
  isTutorialAnalyzerPath,
  isTutorialPlaybookPath,
  parseTutorialPath,
  type TutorialStep,
} from "./query";

const LOADING_NOTICE = "Loading tutorial…";

/** Survives AnalyzerHost remount so a matching session is not installed twice. */
let lastInstalledStep: TutorialStep | null = null;

/** Test hook: isolate path-install state across cases. */
export function resetTutorialInstallState(): void {
  lastInstalledStep = null;
}

function closeIfTutorialSession(session: {
  demo?: { id: string } | null;
  replay: unknown;
  close: () => void;
}): void {
  if (session.replay == null && session.demo == null) return;
  if (!isTutorialDemoId(session.demo?.id)) return;
  session.close();
}

function closeIfForeignSession(session: {
  demo?: { id: string } | null;
  replay: unknown;
  close: () => void;
}): void {
  if (session.replay == null && session.demo == null) return;
  if (isTutorialDemoId(session.demo?.id)) return;
  session.close();
}

function sessionMatchesStep(
  session: {
    demo?: { id: string } | null;
    series: Parameters<typeof isMultiDemoSeries>[0];
    replay: unknown;
  },
  step: TutorialStep,
): boolean {
  if (step === "playbook") return false;
  if (!isTutorialDemoId(session.demo?.id) || session.replay == null) return false;
  if (step === "aggregated") return isMultiDemoSeries(session.series);
  return !isMultiDemoSeries(session.series);
}

async function ensureTutorialPlaybook(): Promise<void> {
  await loadTutorialPlaybook();
}

/**
 * `/tutorial` installer. Puts tutorial fixtures on the same session path as a
 * successful demo drop. Lazy `load.ts` keeps ticks off the cold path.
 */
export function useTutorial(): void {
  const { session, status } = useSession();
  const analyzer = useOptionalAnalyzer();
  const { settings, ready } = useUserSettings();
  const { pathname } = useLocation();
  const step = parseTutorialPath(pathname);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statusRef = useRef(status);
  statusRef.current = status;
  const loadingRef = useRef(false);
  const installedStepRef = useRef<TutorialStep | null>(null);

  useLayoutEffect(() => {
    if (step == null) {
      const live = sessionRef.current;
      const wasTutorial = lastInstalledStep != null || isTutorialDemoId(live.demo?.id);
      lastInstalledStep = null;
      installedStepRef.current = null;
      closeIfTutorialSession(live);
      if (wasTutorial) {
        clearSeriesReviewCache();
        void purgeTutorialProjects();
      }
      return;
    }
    closeIfForeignSession(sessionRef.current);
    if (isTutorialAnalyzerPath(pathname)) {
      if (step === "replay" || step === "aggregated") warmupTutorialSession();
      return;
    }
    if (isTutorialPlaybookPath(pathname)) prefetchNextTutorialStep(step);
  }, [pathname, step]);

  useEffect(() => {
    if (!ready || settings.tutorialCompleted) return;
    if (!isHomePath(pathname)) return;
    return scheduleHomeTutorialPrefetch();
  }, [pathname, ready, settings.tutorialCompleted]);

  useEffect(() => {
    if (step == null) return;

    if (step === "playbook") {
      if (!isTutorialPlaybookPath(pathname)) return;

      if (lastInstalledStep === "playbook") {
        installedStepRef.current = "playbook";
        if (sessionRef.current.replay != null) sessionRef.current.close();
        return;
      }

      let cancelled = false;
      let finished = false;
      loadingRef.current = true;

      void (async () => {
        try {
          await ensureTutorialPlaybook();
          if (cancelled) return;
          lastInstalledStep = "playbook";
          installedStepRef.current = "playbook";
          finished = true;
          if (sessionRef.current.replay != null) sessionRef.current.close();
        } catch (err: unknown) {
          if (cancelled) return;
          lastInstalledStep = null;
          installedStepRef.current = null;
          finished = true;
          statusRef.current.setError(errorMessage(err));
        } finally {
          if (!cancelled) loadingRef.current = false;
        }
      })();

      return () => {
        cancelled = true;
        loadingRef.current = false;
        if (!finished) statusRef.current.clear();
      };
    }

    if (!isTutorialAnalyzerPath(pathname)) return;

    const live = sessionRef.current;
    if (sessionMatchesStep(live, step)) {
      lastInstalledStep = step;
      installedStepRef.current = step;
      return;
    }

    let cancelled = false;
    let finished = false;
    loadingRef.current = true;
    statusRef.current.clear();
    if (step === "replay") {
      warmupTutorialSession();
      statusRef.current.setNotice(LOADING_NOTICE);
    } else {
      const seriesPromise = loadTutorialSeries();
      if (!isTutorialSeriesReady()) {
        statusRef.current.setNotice("Loading Aggregated series…");
      }
      void seriesPromise;
    }
    prefetchNextTutorialStep(step);

    void (async () => {
      try {
        if (step === "replay") {
          const replay = await loadTutorialReplay();
          if (cancelled) return;
          sessionRef.current.installDemo(tutorialReplayDemo(replay));
        } else {
          const series = await loadTutorialSeries();
          if (cancelled) return;
          if (!series) {
            throw new Error("Tutorial series is empty.");
          }
          sessionRef.current.installSeries(series);
        }
        if (cancelled) return;
        lastInstalledStep = step;
        installedStepRef.current = step;
        finished = true;
        statusRef.current.clear();
      } catch (err: unknown) {
        if (cancelled) return;
        lastInstalledStep = null;
        installedStepRef.current = null;
        finished = true;
        statusRef.current.setError(errorMessage(err));
      } finally {
        if (!cancelled) loadingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      loadingRef.current = false;
      if (!finished) statusRef.current.clear();
    };
  }, [pathname, session.replay, step]);

  const setSeriesView = analyzer?.habits.setSeriesView;
  const ensureBucketOverlay = analyzer?.habits.ensureBucketOverlay;
  const aggregatedOn = analyzer?.habits.aggregated ?? false;
  const overlaySide = analyzer?.habits.filter.side ?? "CT";
  const seriesReady = isMultiDemoSeries(session.series);

  useEffect(() => {
    if (step !== "aggregated" || !seriesReady) return;
    if (!aggregatedOn) setSeriesView?.("aggregated");
    ensureBucketOverlay?.("full", overlaySide);
  }, [aggregatedOn, ensureBucketOverlay, overlaySide, seriesReady, setSeriesView, step]);
}
