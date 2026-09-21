import { type ReactNode } from "react";
import { Link } from "react-router";
import { warmupTutorialSession } from "@/lib/tutorial/prefetch";
import { tutorialHref } from "@/lib/tutorial/query";

interface Props {
  children?: ReactNode;
}

/**
 * Home / Analyzer empty-state line under the drop row. Pointer-down warms
 * Replay + Aggregated before the `/tutorial` navigation.
 */
export function TutorialStart({ children }: Props) {
  return (
    <p className="home-faq-hint muted">
      Or{" "}
      <Link to={tutorialHref("replay")} onPointerDown={() => warmupTutorialSession()}>
        try the Tutorial first
      </Link>
      .{children ? <> {children}</> : null}
    </p>
  );
}
