import { useLocation } from "react-router";
import { useSession } from "@/lib/state/sessionState";
import { isTutorialDemoId } from "@/lib/tutorial/identity";
import { isTutorialPath, parseTutorialPath } from "@/lib/tutorial/query";
import { useTutorial } from "@/lib/tutorial/useTutorial";
import { TutorialBanner } from "./TutorialBanner";
import { TutorialCoach } from "./TutorialCoach";

function showTutorialChrome(pathname: string, demoId: string | undefined): boolean {
  if (isTutorialPath(pathname)) return true;
  return isTutorialDemoId(demoId);
}

/** App-shell side effects + coach marks. Banner is shared by Analyzer and Playbook. */
export function TutorialController() {
  useTutorial();
  const { session } = useSession();
  const { pathname } = useLocation();
  const step = parseTutorialPath(pathname) ?? "replay";
  if (!showTutorialChrome(pathname, session.demo?.id)) return null;
  return (
    <>
      <TutorialBanner />
      <TutorialCoach key={step} />
    </>
  );
}
