import { useLocation } from "react-router";
import { parseTutorialPath } from "@/lib/tutorial/query";
import { useTutorial } from "@/lib/tutorial/useTutorial";
import { TutorialBanner } from "./TutorialBanner";
import { TutorialCoach } from "./TutorialCoach";

/** App-shell side effects + coach marks. Banner is shared by Analyzer and Playbook. */
export function TutorialController() {
  useTutorial();
  const { pathname } = useLocation();
  const step = parseTutorialPath(pathname);
  if (step == null) return null;
  return (
    <>
      <TutorialBanner />
      <TutorialCoach key={step} />
    </>
  );
}
