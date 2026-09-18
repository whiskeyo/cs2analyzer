import { useLocation } from "react-router";
import { useSession } from "@/lib/state/sessionState";
import { isTutorialDemoId } from "@/lib/tutorial/identity";
import { parseTutorialQuery } from "@/lib/tutorial/query";
import { useTutorial } from "@/lib/tutorial/useTutorial";
import { TutorialCoach } from "./TutorialCoach";

/** App-shell side effects + coach marks. Banner lives on the Analyzer viewer. */
export function TutorialController() {
  useTutorial();
  const { session } = useSession();
  const { search } = useLocation();
  const step = parseTutorialQuery(search) ?? "replay";
  if (!isTutorialDemoId(session.demo?.id)) return null;
  return <TutorialCoach key={step} />;
}
