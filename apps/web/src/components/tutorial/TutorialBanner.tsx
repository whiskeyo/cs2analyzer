import { Link, useLocation, useNavigate } from "react-router";
import { ROUTES } from "@/lib/app/routes";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { useApp } from "@/lib/state/appState";
import { isTutorialDemoId } from "@/lib/tutorial/identity";
import {
  nextTutorialStep,
  parseTutorialQuery,
  previousTutorialStep,
  tutorialHref,
  type TutorialStep,
} from "@/lib/tutorial/query";

function stepCopy(step: TutorialStep): string {
  if (step === "aggregated") {
    return "Sample habits series on Dust II. Grey rounds sit outside the habits window.";
  }
  if (step === "playbook") {
    return "Sample Mirage playbook. Empty notes on purpose — drawings stay on this machine.";
  }
  return "Sample two-round Mirage match. No .dem on disk.";
}

function nextLabel(step: TutorialStep): string {
  if (step === "replay") return "Next: Aggregated";
  if (step === "aggregated") return "Next: Playbook";
  return "Finish";
}

function backLabel(step: TutorialStep): string {
  if (step === "aggregated") return "Mirage sample";
  if (step === "playbook") return "Habits series";
  return "Back";
}

/** Light chrome while a tutorial fixture is the open session / sample book. */
export function TutorialBanner() {
  const { session } = useApp();
  const { settings, update } = useUserSettings();
  const navigate = useNavigate();
  const { search } = useLocation();
  const fromQuery = parseTutorialQuery(search);
  const tutorialDemo = isTutorialDemoId(session.demo?.id);
  const step: TutorialStep = fromQuery ?? "replay";
  if (fromQuery == null && !tutorialDemo) return null;

  const next = nextTutorialStep(step);
  const previous = previousTutorialStep(step);

  const exit = (completed: boolean) => {
    if (completed && !settings.tutorialCompleted) {
      void update({ tutorialCompleted: true });
    }
    navigate(ROUTES.home);
    session.close();
  };

  return (
    <div className="tutorial-banner" data-tutorial="welcome">
      <span className="tutorial-chip">Tutorial</span>
      <span className="tutorial-banner-copy">{stepCopy(step)}</span>
      {previous ? (
        <Link className="ghost" to={tutorialHref(previous)}>
          {backLabel(step)}
        </Link>
      ) : null}
      {next ? (
        <Link
          className="ghost"
          to={tutorialHref(next)}
          data-tutorial={next === "aggregated" ? "aggregated" : undefined}
        >
          {nextLabel(step)}
        </Link>
      ) : (
        <button type="button" className="ghost" onClick={() => exit(true)}>
          Finish
        </button>
      )}
      <button type="button" className="ghost" onClick={() => exit(false)}>
        Exit tutorial
      </button>
    </div>
  );
}
