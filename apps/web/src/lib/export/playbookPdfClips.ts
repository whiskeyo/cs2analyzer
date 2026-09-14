import type { PDFPage } from "pdf-lib";
import type { PlaybookFloorLayer } from "@/lib/playbook/pages";
import { YOUTUBE_PIN_HEIGHT, YOUTUBE_PIN_WIDTH } from "@/lib/playbook/videos";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { addUriLink, type PdfLinkHit } from "./pdfLinks";
import { playbookPdfPinHit } from "./playbookPdfPins";
import type { PlaybookReportClip } from "./playbookReport";

export interface PlaybookPdfStill {
  floor: PlaybookFloorLayer;
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function playbookPdfVideoPinHits(
  stills: readonly PlaybookPdfStill[],
  clips: readonly PlaybookReportClip[],
  cal: MapCalibration | undefined,
): (PdfLinkHit & { url: string })[] {
  if (!cal) return [];
  const hits: (PdfLinkHit & { url: string })[] = [];
  for (const still of stills) {
    for (const clip of clips) {
      if (clip.floor !== still.floor) continue;
      hits.push({
        url: clip.url,
        page: still.page,
        ...playbookPdfPinHit(clip, cal, still, undefined, {
          width: YOUTUBE_PIN_WIDTH,
          height: YOUTUBE_PIN_HEIGHT,
        }),
      });
    }
  }
  return hits;
}

export function wirePlaybookPdfVideoPins(
  stills: readonly PlaybookPdfStill[],
  clips: readonly PlaybookReportClip[],
  cal: MapCalibration | undefined,
  PDFString: (typeof import("pdf-lib"))["PDFString"],
): void {
  for (const hit of playbookPdfVideoPinHits(stills, clips, cal)) {
    addUriLink(hit.page, hit.x, hit.y, hit.width, hit.height, hit.url, PDFString);
  }
}
