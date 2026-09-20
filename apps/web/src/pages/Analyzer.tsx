import { useEffect } from "react";
import { DemoDrop } from "@/components/app/DemoDrop";
import { Viewer } from "@/components/app/Viewer";
import { TutorialStart } from "@/components/tutorial/TutorialStart";
import { usePathname } from "@/lib/app/devNavigate";
import { useApp } from "@/lib/state/appState";
import { isAnalyzerSessionVisible } from "@/lib/tutorial/query";

export function Analyzer() {
  const { session, review } = useApp();
  const pathname = usePathname();
  const refreshSaved = review.refreshSaved;
  // Re-subscribe on remount: Home → Analyzer unmounts this page (and, after
  // brand Home, AnalyzerRuntime). IndexedDB rows must show without F5.
  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);
  const replay =
    session.replay != null && isAnalyzerSessionVisible(pathname, session.demo?.id)
      ? session.replay
      : null;
  if (replay) return <Viewer />;
  return <DemoDrop showSavedNotes below={<TutorialStart compact />} />;
}
