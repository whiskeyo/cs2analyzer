import type { DrawTool, FloorMode, MapLayers } from "@/lib/notes/types";

export interface MapToolbarReviewState {
  tool: DrawTool;
  color: string;
  paletteId: string;
  floorMode: FloorMode;
  hasFloors: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface MapToolbarViewState {
  follow: boolean;
  trails: boolean;
  moment: boolean;
  canFollow: boolean;
  layers: MapLayers;
}

export interface MapToolbarReviewActions {
  onTool: (tool: DrawTool) => void;
  onColor: (color: string) => void;
  onPalette: (id: string) => void;
  onFloorMode: (mode: FloorMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onStampBookmark: () => void;
}

export interface MapToolbarViewActions {
  onFollow: (follow: boolean) => void;
  onTrails: (trails: boolean) => void;
  onMoment: (moment: boolean) => void;
  onLayers: (layers: MapLayers) => void;
  onResetView: () => void;
}

export interface MapToolbarProps {
  review: MapToolbarReviewState;
  view: MapToolbarViewState;
  reviewActions: MapToolbarReviewActions;
  viewActions: MapToolbarViewActions;
  onSnapshot?: () => void;
  /** False on Aggregated — same `analyzerNotesLive` / `isAggregatedView` gate. */
  drawingsEnabled?: boolean;
}
