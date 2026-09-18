import { Link } from "react-router";
import { tutorialHref } from "@/lib/tutorial/query";

interface Props {
  compact?: boolean;
}

/** Home / Analyzer empty-state CTA. Does not load fixtures until Analyzer mounts. */
export function TutorialStart({ compact = false }: Props) {
  return (
    <p className={compact ? "tutorial-start tutorial-start-compact" : "tutorial-start"}>
      <Link className="ghost" to={tutorialHref("replay")}>
        Try without a demo
      </Link>
      {compact ? (
        <span className="muted"> Short Mirage sample. No file drop.</span>
      ) : (
        <span className="muted">Loads a short Mirage sample in the Analyzer.</span>
      )}
    </p>
  );
}
