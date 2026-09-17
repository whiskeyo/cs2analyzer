import { useEffect } from "react";
import { DemoDrop } from "@/components/app/DemoDrop";
import { Viewer } from "@/components/app/Viewer";
import { useApp } from "@/lib/state/appState";

export function Analyzer() {
  const { session, review } = useApp();
  const refreshSaved = review.refreshSaved;
  // Re-subscribe on remount: Home → Analyzer unmounts this page (and, after
  // brand Home, AnalyzerRuntime). IndexedDB rows must show without F5.
  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);
  if (session.replay) return <Viewer />;
  return <DemoDrop showSavedNotes />;
}
