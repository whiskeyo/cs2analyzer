import { Link, useLocation, useNavigate } from "react-router";
import { ROUTES } from "@/lib/app/routes";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { useApp } from "@/lib/state/appState";
import {
  nextTutorialStep,
  parseTutorialPath,
  previousTutorialStep,
  tutorialHubHref,
  tutorialHref,
  type TutorialStep,
} from "@/lib/tutorial/query";

function stepCopy(step: TutorialStep): string {
  if (step === "aggregated") {
    return "Sample of multiple GOTV demos. Aggregated full is playable; other rounds stay listed but grey.";
  }
  if (step === "playbook") {
    return "Sample Playbook. Open a habits snapshot or a hand-drawn strat; notes stay on this machine.";
  }
  return "Sample of two rounds from GOTV demo";
}

function nextLabel(step: TutorialStep): string {
  if (step === "replay") return "Next: Multiple demos";
  if (step === "aggregated") return "Next: Playbook";
  return "Finish";
}

function backLabel(step: TutorialStep): string {
  if (step === "aggregated") return "Previous: Single demo";
  if (step === "playbook") return "Previous: Multiple demos";
  return "Back";
}

/** Light chrome while a tutorial fixture is the open session / sample book. */
export function TutorialBanner() {
  const { session } = useApp();
  const { settings, update } = useUserSettings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fromPath = parseTutorialPath(pathname);
  if (fromPath == null) return null;
  const step: TutorialStep = fromPath;

  const next = nextTutorialStep(step);
  const previous = previousTutorialStep(step);

  const exit = (completed: boolean) => {
    if (completed && !settings.tutorialCompleted) {
      void update({ tutorialCompleted: true });
    }
    navigate(completed ? ROUTES.analyzer : ROUTES.home);
    session.close();
  };

  return (
    <div className="tutorial-banner">
      <span className="tutorial-chip">Tutorial</span>
      <span className="tutorial-banner-copy">{stepCopy(step)}</span>
      {previous ? (
        <Link className="ghost" to={tutorialHref(previous)}>
          {backLabel(step)}
        </Link>
      ) : (
        <Link className="ghost" to={tutorialHubHref()}>
          Overview
        </Link>
      )}
      {next ? (
        <Link
          className="ghost"
          to={tutorialHref(next)}
          data-tutorial={next === "aggregated" ? "next-aggregated" : "next-playbook"}
          data-tutorial-action={next === "aggregated" ? "next-aggregated" : "next-playbook"}
        >
          {nextLabel(step)}
        </Link>
      ) : (
        <button
          type="button"
          className="ghost"
          data-tutorial="finish"
          data-tutorial-action="finish"
          onClick={() => exit(true)}
        >
          Finish
        </button>
      )}
      <button type="button" className="ghost" onClick={() => exit(false)}>
        Exit tutorial
      </button>
    </div>
  );
}
