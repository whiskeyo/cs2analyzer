import { visibleDrawings } from "@/lib/notes/note";
import type { Drawing, FloorMode, Note } from "@/lib/notes/types";
import { radarFloor, worldToScreen, type RadarView } from "@/lib/radar/maps";
import { paintDrawing, paintDrawings, paintMapImage } from "@/lib/radar/staticMapPaint";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export function playbookUsesLower(cal: MapCalibration | undefined, floorMode: FloorMode): boolean {
  return radarFloor(cal, [], null, floorMode) === "lower";
}

export function paintPlaybookBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: RadarView,
  img: HTMLImageElement | null | undefined,
  cal: MapCalibration | undefined,
  note: Note,
  draft?: Drawing | null,
): void {
  paintMapImage(ctx, w, h, view, img, cal);
  const toScreen = (wx: number, wy: number) => worldToScreen(cal, w, h, view, wx, wy);
  paintDrawings(ctx, visibleDrawings(note, null), toScreen);
  if (draft) {
    paintDrawing(ctx, draft, toScreen, { alpha: 0.85, live: true });
  }
}
