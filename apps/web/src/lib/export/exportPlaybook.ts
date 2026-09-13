import { playbookPageOnFloor, type PlaybookFloorLayer } from "@/lib/playbook/pages";
import type { PlaybookPaintIcons } from "@/lib/playbook/paint";
import { loadPlaybookImageBlobs } from "@/lib/playbook/playbookImageStore";
import type { Playbook } from "@/lib/playbook/types";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { DEFAULT_PDF_THEME, type PdfTheme } from "@/lib/settings/userSettings";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import { downloadBlob } from "@/lib/shared/download";
import { PLAYBOOK_PDF_MIME } from "./constants";
import {
  buildPlaybookPdf,
  type PlaybookPageStills,
  type PlaybookPdfPhotos,
  type PlaybookPdfSnapshots,
} from "./pdfDocument";
import { playbookPdfFilename, playbookReport } from "./playbookReport";
import {
  loadPlaybookSnapshotIcons,
  loadPlaybookSnapshotImage,
  snapshotPlaybookPagePng,
} from "./playbookSnapshot";

async function snapshotFloor(
  page: Playbook["pages"][number],
  cal: MapCalibration | undefined,
  layer: PlaybookFloorLayer,
  icons: PlaybookPaintIcons,
  radarGray: number,
): Promise<Uint8Array | null> {
  const view = playbookPageOnFloor(page, layer);
  const img = await loadPlaybookSnapshotImage(view, cal);
  return snapshotPlaybookPagePng(view, cal, img, icons, undefined, radarGray);
}

export async function snapshotPlaybookPages(
  book: Playbook,
  cal: MapCalibration | undefined,
  radarGray: number = DEFAULT_RADAR_GRAY,
): Promise<PlaybookPdfSnapshots> {
  const snapshots: Record<string, PlaybookPageStills> = {};
  const floors: PlaybookFloorLayer[] = cal?.lower_radar ? ["upper", "lower"] : ["upper"];
  const icons = await loadPlaybookSnapshotIcons();
  for (const page of book.pages) {
    const stills: { upper?: Uint8Array; lower?: Uint8Array } = {};
    for (const layer of floors) {
      const png = await snapshotFloor(page, cal, layer, icons, radarGray);
      if (!png) continue;
      if (layer === "lower") stills.lower = png;
      else stills.upper = png;
    }
    if (stills.upper || stills.lower) snapshots[page.id] = stills;
  }
  return snapshots;
}

export async function loadPlaybookPdfPhotos(book: Playbook): Promise<PlaybookPdfPhotos> {
  const ids = book.pages.flatMap((page) =>
    [...page.images, ...page.lowerImages].map((image) => image.id),
  );
  const blobs = await loadPlaybookImageBlobs(ids);
  const out: Record<string, Uint8Array> = {};
  for (const [id, blob] of blobs) {
    out[id] = new Uint8Array(await blob.arrayBuffer());
  }
  return out;
}

/** Build and download a local PDF for one playbook. The file never leaves the machine. */
export async function downloadPlaybookPdf(
  book: Playbook,
  cal?: MapCalibration,
  exportedAt = Date.now(),
  theme: PdfTheme = DEFAULT_PDF_THEME,
  radarGray: number = DEFAULT_RADAR_GRAY,
  includePhotos = true,
): Promise<void> {
  const report = playbookReport(book, exportedAt);
  const snapshots = await snapshotPlaybookPages(book, cal, radarGray);
  const photos = includePhotos ? await loadPlaybookPdfPhotos(book) : {};
  const bytes = await buildPlaybookPdf(report, snapshots, theme, photos, cal);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  downloadBlob(playbookPdfFilename(report), PLAYBOOK_PDF_MIME, copy);
}
