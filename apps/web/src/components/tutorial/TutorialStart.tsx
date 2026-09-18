import { Link } from "react-router";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { warmupTutorialSession } from "@/lib/tutorial/prefetch";
import { tutorialHref } from "@/lib/tutorial/query";

interface Props {
  compact?: boolean;
}

/** Home / Analyzer empty-state CTA. Pointer-down warms Replay + Aggregated. */
export function TutorialStart({ compact = false }: Props) {
  const { settings, ready, update } = useUserSettings();
  const showDismiss = ready && !settings.tutorialCompleted && !compact;

  return (
    <p className={compact ? "tutorial-start tutorial-start-compact" : "tutorial-start"}>
      <Link
        className="ghost"
        to={tutorialHref("replay")}
        onPointerDown={() => warmupTutorialSession()}
      >
        Try without a demo
      </Link>
      {compact ? (
        <span className="muted"> Short Mirage sample. No file drop.</span>
      ) : (
        <span className="muted">Loads a short Mirage sample in the Analyzer.</span>
      )}
      {showDismiss ? (
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void update({ tutorialCompleted: true });
          }}
        >
          Don&apos;t show again
        </button>
      ) : null}
    </p>
  );
}
