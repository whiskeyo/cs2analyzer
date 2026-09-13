import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { isPenOrArrow, type NoteItemRef } from "@/lib/notes/noteGroups";
import type { Drawing, NadeStyle, Note, Piece } from "@/lib/notes/types";
import { wrapLocalPoint } from "@/lib/shared/pointer";
import { screenToWorld, worldToScreen, type RadarView } from "@/lib/radar/maps";
import { zoomViewAtCursor, wheelZoomFactor } from "@/lib/radar/panZoom.ts";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import {
  addDrawing,
  beginArrow,
  beginPen,
  commitDraft,
  drawingFromRef,
  eraseAt,
  extendDraft,
  hitTestDrawingRef,
  moveDrawingAt,
} from "./drawings";
import { visiblePieces } from "./legend";
import {
  addPiece,
  hitTestPiece,
  movePiece,
  pieceFromTool,
  type PlaybookTool,
  resolvePlaybookDown,
  rotateGizmoHit,
  setPieceYaw,
  yawTowardScreen,
} from "./pieces";
import {
  bounceNadeTrail,
  finishNadeTrail,
  hoverNadeTrail,
  isNadeTrailTool,
  startNadeTrail,
  type NadeTrailDraft,
} from "./nadeTrail";
import { PLAYBOOK_IMAGE_CLICK_PX, hitTestImage, moveImage, removeImage } from "./images";
import type { PlaybookImage, PlaybookYouTube } from "./types";
import { hitTestVideo, moveVideo, removeVideo, YOUTUBE_CLICK_PX } from "./videos";

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

export type DrawingDrag = {
  ref: NoteItemRef;
  lx: number;
  ly: number;
};

export function applyDrawingDrag(
  note: Note,
  drag: DrawingDrag,
  world: { x: number; y: number },
): Note {
  return moveDrawingAt(note, drag.ref, world.x - drag.lx, world.y - drag.ly);
}

export function usePlaybookPointer(opts: {
  wrapRef: RefObject<HTMLDivElement | null>;
  view: MutableRefObject<PlaybookPanView>;
  calRef: MutableRefObject<MapCalibration | undefined>;
  toolRef: MutableRefObject<PlaybookTool>;
  noteRef: MutableRefObject<Note>;
  colorRef: MutableRefObject<string>;
  draftRef: MutableRefObject<Drawing | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gizmoRef: MutableRefObject<string | null>;
  nadeTrailOnRef: MutableRefObject<boolean>;
  nadeStyleRef: MutableRefObject<NadeStyle>;
  nadeTrailRef: MutableRefObject<NadeTrailDraft | null>;
  videosRef: MutableRefObject<readonly PlaybookYouTube[]>;
  imagesRef: MutableRefObject<readonly PlaybookImage[]>;
  openImageIdRef: MutableRefObject<string | null>;
  onNote?: (note: Note) => void;
  onSelect?: (id: string | null) => void;
  onVideos?: (videos: PlaybookYouTube[]) => void;
  onImages?: (images: PlaybookImage[]) => void;
  onOpenImage?: (id: string) => void;
  onOpenVideo?: (id: string) => void;
  onPlaceYouTube?: (at: { x: number; y: number }) => void;
}): void {
  const {
    wrapRef,
    view,
    calRef,
    toolRef,
    noteRef,
    colorRef,
    draftRef,
    canvasRef,
    gizmoRef,
    nadeTrailOnRef,
    nadeStyleRef,
    nadeTrailRef,
    videosRef,
    imagesRef,
    openImageIdRef,
    onNote,
    onSelect,
    onVideos,
    onImages,
    onOpenImage,
    onOpenVideo,
    onPlaceYouTube,
  } = opts;
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onVideosRef = useRef(onVideos);
  onVideosRef.current = onVideos;
  const onOpenVideoRef = useRef(onOpenVideo);
  onOpenVideoRef.current = onOpenVideo;
  const onPlaceYouTubeRef = useRef(onPlaceYouTube);
  onPlaceYouTubeRef.current = onPlaceYouTube;
  const onImagesRef = useRef(onImages);
  onImagesRef.current = onImages;
  const onOpenImageRef = useRef(onOpenImage);
  onOpenImageRef.current = onOpenImage;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let pieceDrag: PieceDrag | null = null;
    let drawingDrag: DrawingDrag | null = null;
    let videoDrag: (PieceDrag & { sx: number; sy: number; moved: boolean }) | null = null;
    let imageDrag: (PieceDrag & { sx: number; sy: number; moved: boolean }) | null = null;

    const pos = (e: MouseEvent | WheelEvent) => wrapLocalPoint(wrap, e);

    const toScreen = (wx: number, wy: number) =>
      worldToScreen(calRef.current, wrap.clientWidth, wrap.clientHeight, view.current, wx, wy);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = pos(e);
      applyPlaybookWheel(view.current, wrap.clientWidth, wrap.clientHeight, x, y, e.deltaY);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (nadeTrailOnRef.current) e.preventDefault();
    };

    const onDown = (e: MouseEvent) => {
      const { x, y } = pos(e);
      const cal = calRef.current;
      if (e.button === 2) {
        if (!nadeTrailOnRef.current || !nadeTrailRef.current || !cal) return;
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        nadeTrailRef.current = bounceNadeTrail(nadeTrailRef.current, world);
        return;
      }
      if (e.button !== 0) return;
      const gizmoId = gizmoRef.current;
      const gizmoPiece = gizmoId
        ? noteRef.current.pieces.find((row) => row.id === gizmoId)
        : undefined;
      if (toolRef.current === "pan" && gizmoPiece?.kind === "pawn" && cal) {
        const at = toScreen(gizmoPiece.x, gizmoPiece.y);
        if (rotateGizmoHit(at, { x, y })) {
          const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
          pieceDrag = pieceDragAt(gizmoPiece, world, true);
          onSelectRef.current?.(gizmoPiece.id);
          return;
        }
      }
      const videoHit = hitTestVideo(videosRef.current, { x, y }, toScreen);
      const imageHit = hitTestImage(imagesRef.current, { x, y }, toScreen);
      const hit = hitTestPiece(visiblePieces(noteRef.current), { x, y }, toScreen);
      const action = resolvePlaybookDown(toolRef.current, hit, e.shiftKey, nadeTrailOnRef.current);
      if (action === "erase") {
        if (videoHit && onVideosRef.current) {
          onVideosRef.current(removeVideo(videosRef.current, videoHit.id));
          gizmoRef.current = null;
          return;
        }
        if (imageHit && onImagesRef.current) {
          onImagesRef.current(removeImage(imagesRef.current, imageHit.id));
          gizmoRef.current = null;
          return;
        }
        if (!cal || !onNoteRef.current) return;
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        const ctx = canvasRef.current?.getContext("2d") ?? null;
        onNoteRef.current(eraseAt(noteRef.current, world, { x, y }, toScreen, ctx));
        gizmoRef.current = null;
        return;
      }
      if (action === "draw") {
        if (!cal) return;
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        draftRef.current =
          toolRef.current === "arrow"
            ? beginArrow(colorRef.current, world)
            : beginPen(colorRef.current, world);
        gizmoRef.current = null;
        return;
      }
      if (action === "nade-trail") {
        if (!cal) return;
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        if (nadeTrailRef.current) {
          if (!onNoteRef.current) return;
          const piece = finishNadeTrail(nadeTrailRef.current, world, nadeStyleRef.current);
          nadeTrailRef.current = null;
          onNoteRef.current(addPiece(noteRef.current, piece));
          onSelectRef.current?.(piece.id);
        } else if (isNadeTrailTool(toolRef.current)) {
          nadeTrailRef.current = startNadeTrail(toolRef.current, world);
        }
        gizmoRef.current = null;
        return;
      }
      if (action === "place") {
        if (!cal) return;
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        if (toolRef.current === "youtube") {
          onPlaceYouTubeRef.current?.(world);
          gizmoRef.current = null;
          return;
        }
        if (!onNoteRef.current) return;
        const piece = pieceFromTool(toolRef.current, world.x, world.y, {
          nadeStyle: nadeStyleRef.current,
        });
        if (!piece) return;
        onNoteRef.current(addPiece(noteRef.current, piece));
        onSelectRef.current?.(piece.id);
        gizmoRef.current = null;
        return;
      }
      if (toolRef.current === "pan" && videoHit && cal) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        videoDrag = {
          id: videoHit.id,
          rotate: false,
          grabDx: videoHit.x - world.x,
          grabDy: videoHit.y - world.y,
          sx: x,
          sy: y,
          moved: false,
        };
        gizmoRef.current = null;
        return;
      }
      if (toolRef.current === "pan" && imageHit && cal) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        imageDrag = {
          id: imageHit.id,
          rotate: false,
          grabDx: imageHit.x - world.x,
          grabDy: imageHit.y - world.y,
          sx: x,
          sy: y,
          moved: false,
        };
        gizmoRef.current = null;
        return;
      }
      if ((action === "move" || action === "rotate") && hit && cal) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        pieceDrag = pieceDragAt(hit, world, action === "rotate");
        onSelectRef.current?.(hit.id);
        if (hit.id !== gizmoRef.current) gizmoRef.current = null;
        return;
      }
      if (action === "pan" && cal && onNoteRef.current) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        const ctx = canvasRef.current?.getContext("2d") ?? null;
        const ref = hitTestDrawingRef(noteRef.current, world, { x, y }, toScreen, ctx);
        const drawing = ref ? drawingFromRef(noteRef.current, ref) : null;
        if (ref && drawing && isPenOrArrow(drawing)) {
          drawingDrag = { ref, lx: world.x, ly: world.y };
          gizmoRef.current = null;
          return;
        }
      }
      gizmoRef.current = null;
      beginPlaybookPan(view.current, x, y);
      if (!hit) onSelectRef.current?.(null);
    };

    const onDblClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (toolRef.current !== "pan") return;
      const { x, y } = pos(e);
      const hit = hitTestPiece(visiblePieces(noteRef.current), { x, y }, toScreen);
      if (hit?.kind !== "pawn") return;
      gizmoRef.current = hit.id;
      onSelectRef.current?.(hit.id);
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = pos(e);
      const drag = pieceDrag;
      const cal = calRef.current;
      if (nadeTrailRef.current && cal) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        nadeTrailRef.current = hoverNadeTrail(nadeTrailRef.current, world);
        return;
      }
      if (draftRef.current && cal) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        draftRef.current = extendDraft(draftRef.current, world);
        return;
      }
      if (imageDrag && cal && onImagesRef.current) {
        if (
          !imageDrag.moved &&
          Math.hypot(x - imageDrag.sx, y - imageDrag.sy) > PLAYBOOK_IMAGE_CLICK_PX
        ) {
          imageDrag.moved = true;
        }
        if (imageDrag.moved) {
          const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
          onImagesRef.current(
            moveImage(
              imagesRef.current,
              imageDrag.id,
              world.x + imageDrag.grabDx,
              world.y + imageDrag.grabDy,
            ),
          );
        }
        return;
      }
      if (videoDrag && cal && onVideosRef.current) {
        if (!videoDrag.moved && Math.hypot(x - videoDrag.sx, y - videoDrag.sy) > YOUTUBE_CLICK_PX) {
          videoDrag.moved = true;
        }
        if (videoDrag.moved) {
          const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
          onVideosRef.current(
            moveVideo(
              videosRef.current,
              videoDrag.id,
              world.x + videoDrag.grabDx,
              world.y + videoDrag.grabDy,
            ),
          );
        }
        return;
      }
      if (drag && cal && onNoteRef.current) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        const piece = noteRef.current.pieces.find((row) => row.id === drag.id);
        if (!piece) return;
        const pieceScreen = toScreen(piece.x, piece.y);
        onNoteRef.current(applyPieceDrag(noteRef.current, drag, world, { x, y }, pieceScreen));
        return;
      }
      const ink = drawingDrag;
      if (ink && cal && onNoteRef.current) {
        const world = screenToWorld(cal, wrap.clientWidth, wrap.clientHeight, view.current, x, y);
        const next = applyDrawingDrag(noteRef.current, ink, world);
        if (next !== noteRef.current) {
          ink.lx = world.x;
          ink.ly = world.y;
          onNoteRef.current(next);
        }
        return;
      }
      movePlaybookPan(view.current, x, y);
    };

    const onUp = () => {
      const draft = draftRef.current;
      draftRef.current = null;
      if (draft && onNoteRef.current) {
        const committed = commitDraft(draft);
        if (committed) {
          onNoteRef.current(addDrawing(noteRef.current, committed));
        }
      }
      if (videoDrag && !videoDrag.moved) {
        onOpenVideoRef.current?.(videoDrag.id);
      }
      if (imageDrag && !imageDrag.moved) {
        onOpenImageRef.current?.(imageDrag.id);
      }
      pieceDrag = null;
      drawingDrag = null;
      videoDrag = null;
      imageDrag = null;
      endPlaybookPan(view.current);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        nadeTrailRef.current = null;
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const selected = openImageIdRef.current;
      if (!selected || !onImagesRef.current) return;
      if (typingTarget(e.target)) return;
      e.preventDefault();
      onImagesRef.current(removeImage(imagesRef.current, selected));
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("mousedown", onDown);
    wrap.addEventListener("contextmenu", onContextMenu);
    wrap.addEventListener("dblclick", onDblClick);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("mousedown", onDown);
      wrap.removeEventListener("contextmenu", onContextMenu);
      wrap.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [
    view,
    wrapRef,
    calRef,
    toolRef,
    noteRef,
    colorRef,
    draftRef,
    canvasRef,
    gizmoRef,
    nadeTrailOnRef,
    nadeStyleRef,
    nadeTrailRef,
    videosRef,
    imagesRef,
    openImageIdRef,
  ]);
}

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("input, textarea, select, [contenteditable]") != null;
}
