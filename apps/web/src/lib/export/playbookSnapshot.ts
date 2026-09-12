import { paintPlaybookBoard, playbookUsesLower, type PlaybookPaintIcons } from "@/lib/playbook/paint";
import type { PlaybookPage } from "@/lib/playbook/types";
import { radarUrl } from "@/lib/radar/maps";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { PLAYBOOK_PDF_RADAR_SIZE } from "./constants";

const SNAPSHOT_VIEW = { scale: 1, ox: 0, oy: 0 };

export function playbookSnapshotRadarFile(
  page: Pick<PlaybookPage, "floor">,
  cal: MapCalibration | undefined,
): string | null {
  if (!cal) return null;
  if (playbookUsesLower(cal, page.floor) && cal.lower_radar) return cal.lower_radar;
  return cal.radar;
}

export function playbookSnapshotRadarUrl(
  page: Pick<PlaybookPage, "floor">,
  cal: MapCalibration | undefined,
): string | null {
  const file = playbookSnapshotRadarFile(page, cal);
  return file ? radarUrl(file) : null;
}

/** Paint one strat the same way the playbook board does (map + strokes + pieces). */
export function paintPlaybookSnapshot(
  ctx: CanvasRenderingContext2D,
  size: number,
  page: PlaybookPage,
  cal: MapCalibration | undefined,
  img: HTMLImageElement | null | undefined,
  icons?: PlaybookPaintIcons,
): void {
  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, size, size);
  paintPlaybookBoard(
    ctx,
    size,
    size,
    SNAPSHOT_VIEW,
    img,
    cal,
    page.note,
    null,
    icons,
    null,
    null,
    null,
    page.videos,
    null,
    null,
  );
}

export function encodeCanvasPng(canvas: Pick<HTMLCanvasElement, "toBlob">): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode radar snapshot."));
        return;
      }
      void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
    }, "image/png");
  });
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export async function loadPlaybookSnapshotImage(
  page: Pick<PlaybookPage, "floor">,
  cal: MapCalibration | undefined,
): Promise<HTMLImageElement | null> {
  const src = playbookSnapshotRadarUrl(page, cal);
  if (!src) return null;
  try {
    return await loadHtmlImage(src);
  } catch {
    return null;
  }
}

export async function snapshotPlaybookPagePng(
  page: PlaybookPage,
  cal: MapCalibration | undefined,
  img: HTMLImageElement | null | undefined,
  icons?: PlaybookPaintIcons,
  size = PLAYBOOK_PDF_RADAR_SIZE,
): Promise<Uint8Array | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintPlaybookSnapshot(ctx, size, page, cal, img, icons);
  try {
    return await encodeCanvasPng(canvas);
  } catch {
    return null;
  }
}
