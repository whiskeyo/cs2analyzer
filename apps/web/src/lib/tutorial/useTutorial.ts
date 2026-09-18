import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { isAnalyzerPath, isHomePath, ROUTES } from "@/lib/app/routes";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { useOptionalAnalyzer } from "@/lib/state/analyzerState";
import { useSession } from "@/lib/state/sessionState";
import { errorMessage } from "@/lib/validate/json.ts";
import { isTutorialDemoId, tutorialReplayDemo } from "./identity";
import { loadTutorialReplay, loadTutorialSeries } from "./load";
import { parseTutorialQuery, tutorialSearch, type TutorialStep } from "./query";

const LOADING_NOTICE = "Loading tutorial…";

/** Survives AnalyzerHost remount when the user closes the session. */
let lastInstalledStep: TutorialStep | null = null;

/** Test hook: isolate query-install state across cases. */
export function resetTutorialInstallState(): void {
  lastInstalledStep = null;
}

function sessionMatchesStep(
  session: {
    demo?: { id: string } | null;
    series: Parameters<typeof isMultiDemoSeries>[0];
    replay: unknown;
  },
  step: TutorialStep,
): boolean {
  if (!isTutorialDemoId(session.demo?.id) || session.replay == null) return false;
  if (step === "aggregated") return isMultiDemoSeries(session.series);
  return !isMultiDemoSeries(session.series);
}

/**
 * Deep-link + Home CTA installer. Puts tutorial fixtures on the same session
 * path as a successful demo drop. Lazy `load.ts` keeps ticks off the cold path.
 */
export function useTutorial(): void {
  const { session, status } = useSession();
  const analyzer = useOptionalAnalyzer();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const step = parseTutorialQuery(search);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statusRef = useRef(status);
  statusRef.current = status;
  const loadingRef = useRef(false);
  const installedStepRef = useRef<TutorialStep | null>(null);

  useEffect(() => {
    if (step == null) {
      lastInstalledStep = null;
      installedStepRef.current = null;
      return;
    }
    if (isHomePath(pathname)) {
      navigate({ pathname: ROUTES.analyzer, search: tutorialSearch(step) }, { replace: true });
      return;
    }
    if (!isAnalyzerPath(pathname)) return;

    const live = sessionRef.current;
    if (sessionMatchesStep(live, step)) {
      lastInstalledStep = step;
      installedStepRef.current = step;
      return;
    }

    if (lastInstalledStep != null && live.replay == null) {
      lastInstalledStep = null;
      installedStepRef.current = null;
      statusRef.current.clear();
      navigate({ pathname: ROUTES.analyzer, search: "" }, { replace: true });
      return;
    }

    let cancelled = false;
    let finished = false;
    loadingRef.current = true;
    statusRef.current.clear();
    statusRef.current.setNotice(LOADING_NOTICE);

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
  }, [navigate, pathname, step]);

  useEffect(() => {
    if (step == null || !isAnalyzerPath(pathname) || loadingRef.current) return;
    if (installedStepRef.current == null) return;
    if (session.replay != null) return;
    installedStepRef.current = null;
    navigate({ pathname: ROUTES.analyzer, search: "" }, { replace: true });
  }, [navigate, pathname, session.replay, step]);

  const setSeriesView = analyzer?.habits.setSeriesView;
  const aggregatedOn = analyzer?.habits.aggregated ?? false;
  const seriesReady = isMultiDemoSeries(session.series);

  useEffect(() => {
    if (step !== "aggregated" || aggregatedOn || !seriesReady) return;
    setSeriesView?.("aggregated");
  }, [aggregatedOn, seriesReady, setSeriesView, step]);
}
