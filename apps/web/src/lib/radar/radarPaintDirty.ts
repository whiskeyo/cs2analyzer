import {
  DEFAULT_HABITS_NADE_FILTER,
  type HabitsNadeFilter,
  type SeriesOverlay,
  type SeriesOverlayDisplay,
} from "@/lib/parse/seriesOverlay";
import { nadeIconLoadCount, type NadeIcons } from "@/lib/radar/draw";
import { worldToRadar, type RadarView } from "@/lib/radar/maps";
import { centerViewOnRadarPoint } from "@/lib/radar/viewport";
import { samplePlayers } from "@/lib/replay/sample";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import type { Drawing, FloorMode, MapLayers, Note, SummaryFilter } from "@/lib/notes/types";

/**
 * Pan the view onto the followed pawn. Runs before the dirty check so a paused
 * follow-cam that has already snapped does not keep rebuilding the frame.
 */
export function applyRadarFollowCam(
  view: RadarView,
  w: number,
  h: number,
  replay: Replay,
  tick: number,
  selected: number | null,
  follow: boolean,
  cal: MapCalibration | undefined,
): void {
  if (!follow || selected == null || !cal) {
    return;
  }
  const pawn = samplePlayers(replay, tick).find(
    (player) => player.index === selected && player.present,
  );
  if (!pawn) {
    return;
  }
  const radar = worldToRadar(cal, pawn.x, pawn.y);
  centerViewOnRadarPoint(view, w, h, radar.x, radar.y);
}

export interface RadarPaintDirtyArgs {
  tick: number;
  view: RadarView;
  layers: MapLayers;
  summaryFilter: SummaryFilter;
  note: Note;
  draft: Drawing | null;
  playSec: number | undefined;
  follow: boolean;
  selected: number | null;
  trails: boolean;
  floorMode: FloorMode;
  habitsOnly: boolean;
  habitsOverlay: SeriesOverlay | null | undefined;
  habitsOverlayDisplay: SeriesOverlayDisplay | undefined;
  habitsShowTrails: boolean;
  habitsShowArrows: boolean;
  habitsNadesOn: boolean;
  habitsNadeOpacity: number;
  habitsNadeFilter: HabitsNadeFilter | undefined;
  cal: MapCalibration | undefined;
  replay: Replay;
  viewEpoch: number;
  imgUpper: HTMLImageElement | null;
  imgLower: HTMLImageElement | null;
  c4: HTMLImageElement | null;
  nadeIcons: NadeIcons;
  textMoveX: number | null;
  textMoveY: number | null;
  editing: boolean;
  skipText: unknown;
  editX: number | null;
  editY: number | null;
  radarGray: number;
  radarPaper: boolean;
}

/**
 * Inputs that force a radar rebuild. Tick is the live playhead (`tickRef`),
 * not the throttled React HUD tick. View / layers / strokes / habits `playSec`
 * plus follow-cam, images, and the text editor.
 */
export function radarPaintInputs(args: RadarPaintDirtyArgs): readonly unknown[] {
  const nadeFilter = args.habitsNadeFilter ?? DEFAULT_HABITS_NADE_FILTER;
  const { layers, summaryFilter: filter, view } = args;
  return [
    args.tick,
    view.scale,
    view.ox,
    view.oy,
    layers.grenades,
    layers.shots,
    layers.names,
    layers.deaths,
    layers.cone,
    layers.heatmap,
    layers.summary,
    layers.openings,
    filter.t,
    filter.ct,
    filter.kinds.smoke,
    filter.kinds.flash,
    filter.kinds.he,
    filter.kinds.molotov,
    filter.kinds.incendiary,
    filter.kinds.decoy,
    args.note,
    args.draft,
    args.playSec,
    args.follow,
    args.selected,
    args.trails,
    args.floorMode,
    args.habitsOnly,
    args.habitsOverlay ?? null,
    args.habitsOverlayDisplay,
    args.habitsShowTrails,
    args.habitsShowArrows,
    args.habitsNadesOn,
    args.habitsNadeOpacity,
    nadeFilter.smoke,
    nadeFilter.molotov,
    nadeFilter.flash,
    nadeFilter.he,
    args.cal,
    args.replay,
    args.viewEpoch,
    args.imgUpper,
    args.imgLower,
    args.c4,
    nadeIconLoadCount(args.nadeIcons),
    args.textMoveX,
    args.textMoveY,
    args.editing,
    args.skipText,
    args.editX,
    args.editY,
    args.radarGray,
    args.radarPaper,
  ];
}
