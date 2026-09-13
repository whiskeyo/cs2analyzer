import type { PDFDocument, PDFImage } from "pdf-lib";
import type { PlaybookReport, PlaybookReportPhoto } from "./playbookReport";

export interface PlaybookPageStills {
  readonly upper?: Uint8Array;
  readonly lower?: Uint8Array;
}

export type PlaybookPdfSnapshots = Readonly<Record<string, PlaybookPageStills>>;
export type PlaybookPdfPhotos = Readonly<Record<string, Uint8Array>>;

export interface EmbeddedStills {
  upper?: PDFImage;
  lower?: PDFImage;
}

async function embedPng(
  pdf: PDFDocument,
  bytes: Uint8Array | undefined,
): Promise<PDFImage | undefined> {
  if (!bytes || bytes.byteLength === 0) return undefined;
  try {
    return await pdf.embedPng(bytes);
  } catch {
    return undefined;
  }
}

async function embedJpg(
  pdf: PDFDocument,
  bytes: Uint8Array | undefined,
): Promise<PDFImage | undefined> {
  if (!bytes || bytes.byteLength === 0) return undefined;
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    return undefined;
  }
}

async function rasterizeImageToPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  try {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const bitmap = await createImageBitmap(new Blob([copy]));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedPlaybookPhoto(
  pdf: PDFDocument,
  photo: PlaybookReportPhoto,
  bytes: Uint8Array | undefined,
): Promise<PDFImage | undefined> {
  if (photo.mime === "image/jpeg") return embedJpg(pdf, bytes);
  if (photo.mime === "image/webp") {
    const png = bytes ? await rasterizeImageToPng(bytes) : null;
    return embedPng(pdf, png ?? undefined);
  }
  return embedPng(pdf, bytes);
}

export async function embedSnapshots(
  pdf: PDFDocument,
  snapshots: PlaybookPdfSnapshots,
): Promise<Map<string, EmbeddedStills>> {
  const images = new Map<string, EmbeddedStills>();
  for (const [id, stills] of Object.entries(snapshots)) {
    const embedded: EmbeddedStills = {
      upper: await embedPng(pdf, stills.upper),
      lower: await embedPng(pdf, stills.lower),
    };
    if (embedded.upper || embedded.lower) images.set(id, embedded);
  }
  return images;
}

export async function embedPhotos(
  pdf: PDFDocument,
  report: PlaybookReport,
  photoBytes: PlaybookPdfPhotos,
): Promise<Map<string, PDFImage>> {
  const images = new Map<string, PDFImage>();
  for (const page of report.pages) {
    for (const photo of page.photos) {
      if (images.has(photo.id)) continue;
      const embedded = await embedPlaybookPhoto(pdf, photo, photoBytes[photo.id]);
      if (embedded) images.set(photo.id, embedded);
    }
  }
  return images;
}
