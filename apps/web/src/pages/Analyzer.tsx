import { DemoDrop } from "@/components/app/DemoDrop";
import { Viewer } from "@/components/app/Viewer";
import { useApp } from "@/lib/state/appState";

export function Analyzer() {
  const { session } = useApp();
  if (session.replay) return <Viewer />;
  return <DemoDrop showSavedNotes />;
}
