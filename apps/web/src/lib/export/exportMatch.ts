import {
  DEFAULT_LAYERS,
  DEFAULT_SUMMARY_FILTER,
  type FloorMode,
  type MapLayers,
  type RoundNote,
  type SummaryFilter,
} from "@/lib/notes/types";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import { DEFAULT_PDF_THEME, type PdfTheme } from "@/lib/settings/userSettings";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import { downloadBlob } from "@/lib/shared/download";
import { PLAYBOOK_PDF_MIME } from "./constants";
import { buildMatchPdf } from "./matchPdf";
import { matchPdfFilename, matchReport } from "./matchReport";
import { snapshotMatchBookmarks } from "./matchSnapshot";

export interface DownloadMatchPdfOpts {
  replay: Replay;
  notes: readonly RoundNote[];
  fileName: string;
  cal?: MapCalibration;
  floorMode?: FloorMode;
  summaryFilter?: SummaryFilter;
  layers?: MapLayers;
  theme?: PdfTheme;
  radarGray?: number;
  exportedAt?: number;
}

/** Build and download a local match PDF. The file never leaves the machine. */
export async function downloadMatchPdf(opts: DownloadMatchPdfOpts): Promise<void> {
  const report = matchReport(opts.replay, opts.notes, opts.fileName, opts.exportedAt);
  const stills = await snapshotMatchBookmarks(
    opts.replay,
    report.bookmarks,
    opts.notes,
    opts.cal,
    opts.layers ?? DEFAULT_LAYERS,
    opts.floorMode ?? "auto",
    opts.summaryFilter ?? DEFAULT_SUMMARY_FILTER,
    opts.radarGray ?? DEFAULT_RADAR_GRAY,
  );
  const bytes = await buildMatchPdf(report, stills, opts.theme ?? DEFAULT_PDF_THEME);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  downloadBlob(matchPdfFilename(report), PLAYBOOK_PDF_MIME, copy);
}
