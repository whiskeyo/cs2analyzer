import { downloadBlob } from "@/lib/shared/download";
import type { Playbook } from "@/lib/playbook/types";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { PLAYBOOK_PDF_MIME } from "./constants";
import { buildPlaybookPdf } from "./pdfDocument";
import { playbookPdfFilename, playbookReport } from "./playbookReport";
import { loadPlaybookSnapshotImage, snapshotPlaybookPagePng } from "./playbookSnapshot";

export async function snapshotPlaybookPages(
  book: Playbook,
  cal: MapCalibration | undefined,
): Promise<Record<string, Uint8Array>> {
  const snapshots: Record<string, Uint8Array> = {};
  for (const page of book.pages) {
    const img = await loadPlaybookSnapshotImage(page, cal);
    const png = await snapshotPlaybookPagePng(page, cal, img);
    if (png) snapshots[page.id] = png;
  }
  return snapshots;
}

/** Build and download a local PDF for one playbook. The file never leaves the machine. */
export async function downloadPlaybookPdf(
  book: Playbook,
  cal?: MapCalibration,
  exportedAt = Date.now(),
): Promise<void> {
  const report = playbookReport(book, exportedAt);
  const snapshots = await snapshotPlaybookPages(book, cal);
  const bytes = await buildPlaybookPdf(report, snapshots);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  downloadBlob(playbookPdfFilename(report), PLAYBOOK_PDF_MIME, copy);
}
