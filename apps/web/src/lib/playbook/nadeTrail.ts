import type { NadeStyle, Piece } from "@/lib/notes/types";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
import { isGrenadePieceKind, makePiece } from "./pieces";

export type WorldPoint = { x: number; y: number };

export interface NadeTrailDraft {
  kind: GrenadeKind;
  points: WorldPoint[];
  hover: WorldPoint | null;
}

export function startNadeTrail(kind: GrenadeKind, world: WorldPoint): NadeTrailDraft {
  return { kind, points: [world], hover: world };
}

export function bounceNadeTrail(draft: NadeTrailDraft, world: WorldPoint): NadeTrailDraft {
  return { ...draft, points: [...draft.points, world], hover: world };
}

export function hoverNadeTrail(draft: NadeTrailDraft, world: WorldPoint): NadeTrailDraft {
  return { ...draft, hover: world };
}

export function nadeTrailPreview(draft: NadeTrailDraft): WorldPoint[] {
  if (!draft.hover) return draft.points;
  return [...draft.points, draft.hover];
}

export function finishNadeTrail(
  draft: NadeTrailDraft,
  land: WorldPoint,
  nadeStyle: NadeStyle = "icon",
): Piece {
  return makePiece(draft.kind, land.x, land.y, {
    trail: draft.points,
    nadeStyle,
  });
}

export function isNadeTrailTool(tool: string): tool is GrenadeKind {
  return isGrenadePieceKind(tool as Piece["kind"]);
}
