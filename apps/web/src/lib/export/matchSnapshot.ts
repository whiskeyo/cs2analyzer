import { noteForRound } from "@/lib/notes/roundNotes";
import {
  DEFAULT_LAYERS,
  DEFAULT_SUMMARY_FILTER,
  type FloorMode,
  type MapLayers,
  type Note,
  type SummaryFilter,
} from "@/lib/notes/types";
import type { PlaybookPaintIcons } from "@/lib/playbook/paint";
import { paintPawns, paintRadarFrame } from "@/lib/radar/paintRadarFrame";
import { buildRadarFrame } from "@/lib/radar/radarFrame";
import { radarUrl, worldToScreen } from "@/lib/radar/maps";
import { paintMapImage, paintNote } from "@/lib/radar/staticMapPaint";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import { PLAYBOOK_PDF_RADAR_SIZE } from "./constants";
import type { MatchPdfStills } from "./matchPdf";
import type { MatchReportBookmark } from "./matchReport";
import { encodeCanvasPng, loadHtmlImage, loadPlaybookSnapshotIcons } from "./playbookSnapshot";

const SNAPSHOT_VIEW = { scale: 1, ox: 0, oy: 0 };

export function matchSnapshotRadarFile(
  cal: MapCalibration | undefined,
  useLower: boolean,
): string | null {
  if (!cal) return null;
  if (useLower && cal.lower_radar) return cal.lower_radar;
  return cal.radar;
}

export async function loadMatchSnapshotImage(
  cal: MapCalibration | undefined,
  useLower: boolean,
): Promise<HTMLImageElement | null> {
  const file = matchSnapshotRadarFile(cal, useLower);
  if (!file) return null;
  try {
    return await loadHtmlImage(radarUrl(file));
  } catch {
    return null;
  }
}

/** Map + live pawns/nades + notes at one bookmark tick. No app panel fill. */
export function paintMatchSnapshot(
  ctx: CanvasRenderingContext2D,
  size: number,
  replay: Replay,
  tick: number,
  cal: MapCalibration | undefined,
  note: Note,
  img: HTMLImageElement | null | undefined,
  icons?: PlaybookPaintIcons,
  layers: MapLayers = DEFAULT_LAYERS,
  floorMode: FloorMode = "auto",
  summaryFilter: SummaryFilter = DEFAULT_SUMMARY_FILTER,
  radarGray: number = DEFAULT_RADAR_GRAY,
): void {
  ctx.clearRect(0, 0, size, size);
  const frame = buildRadarFrame({
    replay,
    tick,
    layers,
    summaryFilter,
    selected: null,
    trails: false,
    floorMode,
    cal,
    scale: SNAPSHOT_VIEW.scale,
    habitsOnly: false,
  });
  const toScreen = (wx: number, wy: number) =>
    worldToScreen(cal, size, size, SNAPSHOT_VIEW, wx, wy);
  paintMapImage(ctx, size, size, SNAPSHOT_VIEW, img, cal, radarGray);
  paintRadarFrame(ctx, frame, toScreen, {
    scale: SNAPSHOT_VIEW.scale,
    c4Icon: icons?.c4 ?? null,
    packC4Icon: icons?.c4 ?? null,
    nadeIcons: icons?.nades,
  });
  paintNote(ctx, note, toScreen, { tick });
  paintPawns(ctx, frame, toScreen, layers.names, icons?.c4 ?? null);
}

export async function snapshotMatchBookmarkPng(
  replay: Replay,
  tick: number,
  cal: MapCalibration | undefined,
  note: Note,
  icons?: PlaybookPaintIcons,
  layers: MapLayers = DEFAULT_LAYERS,
  floorMode: FloorMode = "auto",
  summaryFilter: SummaryFilter = DEFAULT_SUMMARY_FILTER,
  radarGray: number = DEFAULT_RADAR_GRAY,
  size = PLAYBOOK_PDF_RADAR_SIZE,
): Promise<Uint8Array | null> {
  const frame = buildRadarFrame({
    replay,
    tick,
    layers,
    summaryFilter,
    selected: null,
    trails: false,
    floorMode,
    cal,
    scale: 1,
    habitsOnly: false,
  });
  const img = await loadMatchSnapshotImage(cal, frame.useLowerFloor);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintMatchSnapshot(
    ctx,
    size,
    replay,
    tick,
    cal,
    note,
    img,
    icons,
    layers,
    floorMode,
    summaryFilter,
    radarGray,
  );
  try {
    return await encodeCanvasPng(canvas);
  } catch {
    return null;
  }
}

export async function snapshotMatchBookmarks(
  replay: Replay,
  bookmarks: readonly MatchReportBookmark[],
  notes: readonly { round: number; note: Note }[],
  cal: MapCalibration | undefined,
  layers: MapLayers = DEFAULT_LAYERS,
  floorMode: FloorMode = "auto",
  summaryFilter: SummaryFilter = DEFAULT_SUMMARY_FILTER,
  radarGray: number = DEFAULT_RADAR_GRAY,
): Promise<MatchPdfStills> {
  if (bookmarks.length === 0) return {};
  const icons = await loadPlaybookSnapshotIcons();
  const stills: Record<string, Uint8Array> = {};
  for (const mark of bookmarks) {
    const png = await snapshotMatchBookmarkPng(
      replay,
      mark.tick,
      cal,
      noteForRound(notes, mark.round),
      icons,
      layers,
      floorMode,
      summaryFilter,
      radarGray,
    );
    if (png) stills[mark.id] = png;
  }
  return stills;
}
