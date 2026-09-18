import { useLocation } from "react-router";
import { isPlaybookPath } from "@/lib/app/routes";
import { useSession } from "@/lib/state/sessionState";
import { isTutorialDemoId } from "@/lib/tutorial/identity";
import { parseTutorialQuery } from "@/lib/tutorial/query";
import { useTutorial } from "@/lib/tutorial/useTutorial";
import { TutorialBanner } from "./TutorialBanner";
import { TutorialCoach } from "./TutorialCoach";

function showTutorialChrome(pathname: string, search: string, demoId: string | undefined): boolean {
  const step = parseTutorialQuery(search);
  if (step === "playbook" && isPlaybookPath(pathname)) return true;
  return isTutorialDemoId(demoId);
}

/** App-shell side effects + coach marks. Banner is shared by Analyzer and Playbook. */
export function TutorialController() {
  useTutorial();
  const { session } = useSession();
  const { pathname, search } = useLocation();
  const step = parseTutorialQuery(search) ?? "replay";
  if (!showTutorialChrome(pathname, search, session.demo?.id)) return null;
  return (
    <>
      <TutorialBanner />
      <TutorialCoach key={step} />
    </>
  );
}
