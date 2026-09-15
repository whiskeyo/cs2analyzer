import type { Drawing, DrawingGroup, NoteRadarFx, Piece } from "@/lib/notes/types";
import { isGrenadePieceKind } from "./pieces";
import { radarFxIsEmpty } from "./snapshot";

/** Layers a snapshot can stamp. Default is a full stamp (today’s behavior). */
export interface SnapshotLayers {
  pawns: boolean;
  util: boolean;
  kills: boolean;
  drawings: boolean;
}

export const DEFAULT_SNAPSHOT_LAYERS: SnapshotLayers = {
  pawns: true,
  util: true,
  kills: true,
  drawings: true,
};

export const SNAPSHOT_LAYER_OPTIONS: {
  id: keyof SnapshotLayers;
  label: string;
}[] = [
  { id: "pawns", label: "Pawns" },
  { id: "util", label: "Util" },
  { id: "kills", label: "Kills" },
  { id: "drawings", label: "Drawings" },
];

export function snapshotLayerSelected(layers: SnapshotLayers): boolean {
  return layers.pawns || layers.util || layers.kills || layers.drawings;
}

function isUtilPiece(piece: Piece): boolean {
  return isGrenadePieceKind(piece.kind) || piece.kind === "bomb";
}

export function filterSnapshotPieces(pieces: readonly Piece[], layers: SnapshotLayers): Piece[] {
  return pieces.filter((piece) => {
    if (piece.kind === "pawn") return layers.pawns;
    if (isUtilPiece(piece)) return layers.util;
    return true;
  });
}

export function filterSnapshotRadarFx(
  radarFx: NoteRadarFx | undefined,
  layers: SnapshotLayers,
): NoteRadarFx | undefined {
  if (!radarFx) return undefined;
  const next: NoteRadarFx = {
    deaths: layers.kills ? radarFx.deaths : [],
    opening: layers.kills ? radarFx.opening : null,
    tracers: layers.kills ? radarFx.tracers : [],
    hits: layers.kills ? radarFx.hits : [],
    trails: layers.pawns ? radarFx.trails : [],
    cone: layers.pawns ? radarFx.cone : null,
    flashes: layers.util ? radarFx.flashes : [],
    heatmap: layers.util ? radarFx.heatmap : [],
    summary: layers.util ? radarFx.summary : [],
  };
  return radarFxIsEmpty(next) ? undefined : next;
}

export function filterSnapshotGroups(
  groups: readonly DrawingGroup[],
  pieces: readonly Piece[],
  layers: SnapshotLayers,
): DrawingGroup[] {
  const pawnGroupIds = new Set(
    pieces.filter((piece) => piece.kind === "pawn" && piece.groupId).map((piece) => piece.groupId),
  );
  const next: DrawingGroup[] = [];
  for (const group of groups) {
    const drawings = layers.drawings ? group.drawings : [];
    const keepPawn = layers.pawns && group.id !== "" && pawnGroupIds.has(group.id);
    if (!keepPawn && drawings.length === 0) continue;
    next.push(drawings === group.drawings ? group : { ...group, drawings });
  }
  return next;
}

export function applySnapshotLayers<
  T extends {
    pieces: Piece[];
    groups?: DrawingGroup[];
    radarFx?: NoteRadarFx;
    drawings?: Drawing[];
  },
>(snap: T, layers: SnapshotLayers): T {
  const pieces = filterSnapshotPieces(snap.pieces, layers);
  const drawings = layers.drawings ? (snap.drawings ?? []) : [];
  const groups = filterSnapshotGroups(snap.groups ?? [], pieces, layers);
  const radarFx = filterSnapshotRadarFx(snap.radarFx, layers);
  return {
    ...snap,
    pieces,
    groups: groups.length > 0 ? groups : undefined,
    radarFx,
    drawings: drawings.length > 0 ? drawings : undefined,
  };
}
