import { useCallback, useState } from "react";
import { isAggregatedView } from "@/lib/parse/seriesMode";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { useApp } from "@/lib/state/appState";
import { MATCH_PDF_EXPORT_ERROR } from "./constants";
import { downloadMatchPdf } from "./exportMatch";

/** Analyzer header / Notes tab — one local PDF for the loaded match. */
export function useMatchPdfExport() {
  const { session, review, cal, habits } = useApp();
  const { settings } = useUserSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);

  const exportPdf = useCallback(async () => {
    if (!replay || busy) return;
    setBusy(true);
    setError(null);
    try {
      await downloadMatchPdf({
        replay,
        notes: review.notes,
        fileName: session.fileName ?? "",
        cal,
        floorMode: review.floorMode,
        summaryFilter: review.summaryFilter,
        layers: settings.defaultLayers,
        theme: settings.pdfTheme,
        radarGray: settings.radarGray,
      });
    } catch {
      setError(MATCH_PDF_EXPORT_ERROR);
    } finally {
      setBusy(false);
    }
  }, [busy, cal, replay, review, session.fileName, settings]);

  return {
    canExport: replay != null && !aggregated,
    aggregated,
    busy,
    error,
    exportPdf,
  };
}
