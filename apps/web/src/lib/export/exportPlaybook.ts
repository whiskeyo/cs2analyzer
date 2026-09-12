import { playbookPageOnFloor, type PlaybookFloorLayer } from "@/lib/playbook/pages";
import type { Playbook } from "@/lib/playbook/types";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { DEFAULT_PDF_THEME, type PdfTheme } from "@/lib/settings/userSettings";
import { downloadBlob } from "@/lib/shared/download";
import { PLAYBOOK_PDF_MIME } from "./constants";
import {
  buildPlaybookPdf,
  type PlaybookPageStills,
  type PlaybookPdfSnapshots,
} from "./pdfDocument";
import { playbookPdfFilename, playbookReport } from "./playbookReport";
import { loadPlaybookSnapshotImage, snapshotPlaybookPagePng } from "./playbookSnapshot";

async function snapshotFloor(
  page: Playbook["pages"][number],
  cal: MapCalibration | undefined,
  layer: PlaybookFloorLayer,
): Promise<Uint8Array | null> {
  const view = playbookPageOnFloor(page, layer);
  const img = await loadPlaybookSnapshotImage(view, cal);
  return snapshotPlaybookPagePng(view, cal, img);
}

export async function snapshotPlaybookPages(
  book: Playbook,
  cal: MapCalibration | undefined,
): Promise<PlaybookPdfSnapshots> {
  const snapshots: Record<string, PlaybookPageStills> = {};
  const floors: PlaybookFloorLayer[] = cal?.lower_radar ? ["upper", "lower"] : ["upper"];
  for (const page of book.pages) {
    const stills: { upper?: Uint8Array; lower?: Uint8Array } = {};
    for (const layer of floors) {
      const png = await snapshotFloor(page, cal, layer);
      if (!png) continue;
      if (layer === "lower") stills.lower = png;
      else stills.upper = png;
    }
    if (stills.upper || stills.lower) snapshots[page.id] = stills;
  }
  return snapshots;
}

/** Build and download a local PDF for one playbook. The file never leaves the machine. */
export async function downloadPlaybookPdf(
  book: Playbook,
  cal?: MapCalibration,
  exportedAt = Date.now(),
  theme: PdfTheme = DEFAULT_PDF_THEME,
): Promise<void> {
  const report = playbookReport(book, exportedAt);
  const snapshots = await snapshotPlaybookPages(book, cal);
  const bytes = await buildPlaybookPdf(report, snapshots, theme);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  downloadBlob(playbookPdfFilename(report), PLAYBOOK_PDF_MIME, copy);
}
