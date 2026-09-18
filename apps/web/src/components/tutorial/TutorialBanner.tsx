import { Link, useLocation, useNavigate } from "react-router";
import { ROUTES } from "@/lib/app/routes";
import { useApp } from "@/lib/state/appState";
import { isTutorialDemoId } from "@/lib/tutorial/identity";
import { parseTutorialQuery, tutorialHref } from "@/lib/tutorial/query";

/** Light Analyzer chrome while a tutorial fixture is the open session. */
export function TutorialBanner() {
  const { session } = useApp();
  const navigate = useNavigate();
  const { search } = useLocation();
  const step = parseTutorialQuery(search) ?? "replay";
  if (!isTutorialDemoId(session.demo?.id)) return null;

  const aggregated = step === "aggregated";

  return (
    <div className="tutorial-banner" data-tutorial="welcome">
      <span className="tutorial-chip">Tutorial</span>
      <span className="tutorial-banner-copy">
        {aggregated
          ? "Sample habits series on Dust II. Grey rounds sit outside the habits window."
          : "Sample two-round Mirage match. No .dem on disk."}
      </span>
      {aggregated ? (
        <Link className="ghost" to={tutorialHref("replay")}>
          Mirage sample
        </Link>
      ) : (
        <Link className="ghost" to={tutorialHref("aggregated")} data-tutorial="aggregated">
          Try Aggregated
        </Link>
      )}
      <span className="tutorial-banner-next muted">Playbook tour — next</span>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          session.close();
          navigate(ROUTES.home);
        }}
      >
        Exit tutorial
      </button>
    </div>
  );
}
