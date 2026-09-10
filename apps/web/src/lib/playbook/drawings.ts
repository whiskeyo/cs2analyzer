import { cloneNote, windowVisible } from "@/lib/notes/note";
import { removeItems, type NoteItemRef } from "@/lib/notes/noteGroups";
import type { Drawing, Note } from "@/lib/notes/types";
import { hitTextLabel } from "@/lib/radar/draw";
import { PEN_MIN_SAMPLE_DISTANCE } from "@/lib/shared/constants";
import { removePiece, hitTestPiece, PIECE_HIT_PX } from "./pieces";

/** World-unit radius for erasing a pen/arrow, same as Analyzer. */
export const ERASE_HIT_WORLD = 48;

export const DEFAULT_TEXT_LABEL = "Text";

export function addDrawing(note: Note, drawing: Drawing): Note {
  const next = cloneNote(note);
  next.drawings.push(drawing);
  return next;
}

export function drawingFromRef(note: Note, ref: NoteItemRef): Drawing | null {
  if (ref.kind === "loose") return note.drawings[ref.index] ?? null;
  if (ref.kind === "group") {
    return note.groups[ref.groupIndex]?.drawings[ref.drawingIndex] ?? null;
  }
  return null;
}

export function translateDrawing(drawing: Drawing, dx: number, dy: number): Drawing {
  if (dx === 0 && dy === 0) return drawing;
  if (drawing.type === "pen") {
    return { ...drawing, points: drawing.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) };
  }
  if (drawing.type === "arrow") {
    return {
      ...drawing,
      from: { x: drawing.from.x + dx, y: drawing.from.y + dy },
      to: { x: drawing.to.x + dx, y: drawing.to.y + dy },
    };
  }
  if (drawing.type === "text") {
    return { ...drawing, x: drawing.x + dx, y: drawing.y + dy };
  }
  return drawing;
}

export function moveDrawingAt(note: Note, ref: NoteItemRef, dx: number, dy: number): Note {
  if (dx === 0 && dy === 0) return note;
  const next = cloneNote(note);
  if (ref.kind === "loose") {
    const drawing = next.drawings[ref.index];
    if (!drawing) return note;
    next.drawings[ref.index] = translateDrawing(drawing, dx, dy);
    return next;
  }
  if (ref.kind === "group") {
    const group = next.groups[ref.groupIndex];
    const drawing = group?.drawings[ref.drawingIndex];
    if (!group || !drawing) return note;
    group.drawings[ref.drawingIndex] = translateDrawing(drawing, dx, dy);
    return next;
  }
  return note;
}

export function hitDrawing(
  drawing: Drawing,
  world: { x: number; y: number },
  maxDist = ERASE_HIT_WORLD,
): boolean {
  if (drawing.type === "text") return false;
  const distSq = maxDist * maxDist;
  if (drawing.type === "pen") {
    return drawing.points.some((pt) => (pt.x - world.x) ** 2 + (pt.y - world.y) ** 2 < distSq);
  }
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = drawing.from.x + (drawing.to.x - drawing.from.x) * t;
    const py = drawing.from.y + (drawing.to.y - drawing.from.y) * t;
    if ((px - world.x) ** 2 + (py - world.y) ** 2 < distSq) return true;
  }
  return false;
}

export function hitTestDrawingRef(
  note: Note,
  world: { x: number; y: number },
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  ctx: CanvasRenderingContext2D | null,
  tick: number | null = null,
): NoteItemRef | null {
  for (let i = note.drawings.length - 1; i >= 0; i--) {
    const item = note.drawings[i];
    if (!item || item.hidden || !windowVisible(item, tick)) continue;
    if (drawingHit(item, world, screen, toScreen, ctx)) {
      return { kind: "loose", index: i };
    }
  }
  for (let g = note.groups.length - 1; g >= 0; g--) {
    const group = note.groups[g];
    if (!group || group.hidden || !windowVisible(group, tick)) continue;
    for (let d = group.drawings.length - 1; d >= 0; d--) {
      const drawing = group.drawings[d];
      if (!drawing || drawing.hidden) continue;
      if (drawingHit(drawing, world, screen, toScreen, ctx)) {
        return { kind: "group", groupIndex: g, drawingIndex: d };
      }
    }
  }
  return null;
}

function drawingHit(
  drawing: Drawing,
  world: { x: number; y: number },
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  ctx: CanvasRenderingContext2D | null,
): boolean {
  if (drawing.type === "text") {
    if (!ctx) return false;
    return hitTextLabel(ctx, drawing, toScreen(drawing.x, drawing.y), screen.x, screen.y);
  }
  return hitDrawing(drawing, world);
}

export function eraseAt(
  note: Note,
  world: { x: number; y: number },
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  ctx: CanvasRenderingContext2D | null,
  tick: number | null = null,
): Note {
  const piece = hitTestPiece(note.pieces, screen, toScreen, PIECE_HIT_PX);
  if (piece) return removePiece(note, piece.id);
  const ref = hitTestDrawingRef(note, world, screen, toScreen, ctx, tick);
  if (!ref) return note;
  return removeItems(note, [ref]);
}

export function beginPen(color: string, at: { x: number; y: number }): Drawing {
  return { type: "pen", color, points: [at] };
}

export function beginArrow(color: string, at: { x: number; y: number }): Drawing {
  return { type: "arrow", color, from: at, to: at };
}

export function extendDraft(draft: Drawing, at: { x: number; y: number }): Drawing {
  if (draft.type === "pen") {
    const last = draft.points[draft.points.length - 1];
    if (!last || Math.hypot(at.x - last.x, at.y - last.y) < PEN_MIN_SAMPLE_DISTANCE) {
      return draft;
    }
    return { ...draft, points: [...draft.points, at] };
  }
  if (draft.type === "arrow") {
    return { ...draft, to: at };
  }
  return draft;
}

export function commitDraft(draft: Drawing): Drawing | null {
  if (draft.type === "pen") {
    return draft.points.length >= 2 ? draft : null;
  }
  if (draft.type === "arrow") {
    if (draft.from.x === draft.to.x && draft.from.y === draft.to.y) return null;
    return draft;
  }
  if (draft.type === "text" && draft.text.trim() === "") return null;
  return draft;
}

export function placeText(
  color: string,
  at: { x: number; y: number },
  text = DEFAULT_TEXT_LABEL,
): Drawing {
  return { type: "text", color, x: at.x, y: at.y, text };
}
