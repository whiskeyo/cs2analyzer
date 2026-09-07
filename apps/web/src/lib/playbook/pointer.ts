import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { Note, Piece } from "@/lib/notes/types";
import { screenToWorld, worldToScreen, type RadarView } from "@/lib/radar/maps";
import { zoomViewAtCursor, wheelZoomFactor } from "@/lib/radar/panZoom.ts";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import {
  addPiece,
  hitTestPiece,
  movePiece,
  pieceFromTool,
  type PlaybookTool,
  resolvePlaybookDown,
  setPieceYaw,
  yawTowardScreen,
} from "./pieces";

export type PlaybookPanView = RadarView & {
  dragging: boolean;
  lx: number;
  ly: number;
};

export type PieceDrag = {
  id: string;
  rotate: boolean;
  grabDx: number;
  grabDy: number;
};

export function createPlaybookView(): PlaybookPanView {
  return { scale: 1, ox: 0, oy: 0, dragging: false, lx: 0, ly: 0 };
}

export function applyPlaybookWheel(
  view: PlaybookPanView,
  w: number,
  h: number,
  mx: number,
  my: number,
  deltaY: number,
): void {
  zoomViewAtCursor(view, w, h, mx, my, wheelZoomFactor(deltaY));
}

export function beginPlaybookPan(view: PlaybookPanView, x: number, y: number): void {
  view.dragging = true;
  view.lx = x;
  view.ly = y;
}

export function movePlaybookPan(view: PlaybookPanView, x: number, y: number): void {
  if (!view.dragging) return;
  view.ox += x - view.lx;
  view.oy += y - view.ly;
  view.lx = x;
  view.ly = y;
}

export function endPlaybookPan(view: PlaybookPanView): void {
  view.dragging = false;
}

export function pieceDragAt(
  hit: Piece,
  world: { x: number; y: number },
  rotate: boolean,
): PieceDrag {
  return {
    id: hit.id,
    rotate,
    grabDx: hit.x - world.x,
    grabDy: hit.y - world.y,
  };
}

export function applyPieceDrag(
  note: Note,
  drag: PieceDrag,
  world: { x: number; y: number },
  screen: { x: number; y: number },
  pieceScreen: { x: number; y: number },
): Note {
  if (!note.pieces.some((row) => row.id === drag.id)) return note;
  if (drag.rotate) {
    return setPieceYaw(note, drag.id, yawTowardScreen(pieceScreen, screen));
  }
  return movePiece(note, drag.id, world.x + drag.grabDx, world.y + drag.grabDy);
}

export function usePlaybookPointer(opts: {
  wrapRef: RefObject<HTMLDivElement | null>;
  view: MutableRefObject<PlaybookPanView>;
  calRef: MutableRefObject<MapCalibration | undefined>;
  toolRef: MutableRefObject<PlaybookTool>;
  noteRef: MutableRefObject<Note>;
  onNote?: (note: Note) => void;
  onSelect?: (id: string | null) => void;
}): void {
  const { wrapRef, view, calRef, toolRef, noteRef, onNote, onSelect } = opts;
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let pieceDrag: PieceDrag | null = null;

    const pos = (e: MouseEvent | WheelEvent) => {
      const rect = wrap.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const toScreen = (wx: number, wy: number) =>
      worldToScreen(calRef.current, wrap.clientWidth, wrap.clientHeight, view.current, wx, wy);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = pos(e);
      applyPlaybookWheel(view.current, wrap.clientWidth, wrap.clientHeight, x, y, e.deltaY);
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { x, y } = pos(e);
      const hit = hitTestPiece(noteRef.current.pieces, { x, y }, toScreen);
      const action = resolvePlaybookDown(toolRef.current, hit, e.shiftKey);
      const cal = calRef.current;
      if (action === "place") {
        if (!cal || !onNoteRef.current) return;
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        const piece = pieceFromTool(toolRef.current, world.x, world.y);
        if (!piece) return;
        onNoteRef.current(addPiece(noteRef.current, piece));
        onSelectRef.current?.(piece.id);
        return;
      }
      if ((action === "move" || action === "rotate") && hit && cal) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        pieceDrag = pieceDragAt(hit, world, action === "rotate");
        onSelectRef.current?.(hit.id);
        return;
      }
      beginPlaybookPan(view.current, x, y);
      if (!hit) onSelectRef.current?.(null);
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = pos(e);
      const drag = pieceDrag;
      const cal = calRef.current;
      if (drag && cal && onNoteRef.current) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        const piece = noteRef.current.pieces.find((row) => row.id === drag.id);
        if (!piece) return;
        const pieceScreen = toScreen(piece.x, piece.y);
        onNoteRef.current(applyPieceDrag(noteRef.current, drag, world, { x, y }, pieceScreen));
        return;
      }
      movePlaybookPan(view.current, x, y);
    };

    const onUp = () => {
      pieceDrag = null;
      endPlaybookPan(view.current);
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [view, wrapRef, calRef, toolRef, noteRef]);
}
