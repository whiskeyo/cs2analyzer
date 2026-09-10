import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { NOTE_TEXT_DRAG_PX, tickRate } from "@/lib/shared/constants";
import { wrapLocalPoint } from "@/lib/shared/pointer";
import { clampViewScale, wheelZoomFactor } from "@/lib/radar/panZoom.ts";
import { screenToWorld, worldToScreen, type RadarView } from "@/lib/radar/maps";
import { addBookmark, makeBookmark, withMoment } from "@/lib/notes";
import {
  addDrawing,
  beginArrow,
  beginPen,
  commitDraft,
  drawingFromRef,
  eraseAt,
  extendDraft,
  moveDrawingAt,
} from "@/lib/playbook/drawings";
import { findTextRef } from "./draw";
import type { TextEdit, TextEditDrag, TextMove } from "@/components/radar/TextNoteEditor";
import { currentRound } from "@/lib/replay/sample";
import { simplifyStroke } from "@/lib/radar/strokes";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import type { DrawTool, Drawing, Note } from "@/lib/notes/types";

export type RadarPanView = RadarView & {
  dragging: boolean;
  dragged: boolean;
  lx: number;
  ly: number;
  drawing: boolean;
};

export interface RadarPointerOpts {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  view: MutableRefObject<RadarPanView>;
  calRef: MutableRefObject<MapCalibration | undefined>;
  toolRef: MutableRefObject<DrawTool>;
  replayRef: MutableRefObject<Replay>;
  tickRef: MutableRefObject<number>;
  colorRef: MutableRefObject<string>;
  momentRef: MutableRefObject<boolean>;
  noteRef: MutableRefObject<Note>;
  onNoteRef: MutableRefObject<(next: Note) => void>;
  onPauseRef: MutableRefObject<() => void>;
  onPanRef: MutableRefObject<() => void>;
  draft: MutableRefObject<Drawing | null>;
  penTip: MutableRefObject<{ x: number; y: number } | null>;
  suppressClickRef: MutableRefObject<boolean>;
  textMoveRef: MutableRefObject<TextMove | null>;
  editDragRef: MutableRefObject<TextEditDrag | null>;
  editingRef: MutableRefObject<TextEdit | null>;
  editWrapRef: RefObject<HTMLDivElement | null>;
  ignoreBlurRef: MutableRefObject<boolean>;
  commitEditingRef: MutableRefObject<() => void>;
  beginEditingRef: MutableRefObject<(next: TextEdit) => void>;
  setEditing: Dispatch<SetStateAction<TextEdit | null>>;
  focusEditor: () => void;
}

export function useRadarPointer(opts: RadarPointerOpts) {
  const {
    wrapRef,
    canvasRef,
    view,
    calRef,
    toolRef,
    replayRef,
    tickRef,
    colorRef,
    momentRef,
    noteRef,
    onNoteRef,
    onPauseRef,
    onPanRef,
    draft,
    penTip,
    suppressClickRef,
    textMoveRef,
    editDragRef,
    editingRef,
    editWrapRef,
    ignoreBlurRef,
    commitEditingRef,
    beginEditingRef,
    setEditing,
    focusEditor,
  } = opts;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const pos = (e: MouseEvent) => wrapLocalPoint(wrap, e);

    const toScreen = (wx: number, wy: number) =>
      worldToScreen(calRef.current, wrap.clientWidth, wrap.clientHeight, view.current, wx, wy);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      v.scale = clampViewScale(v.scale * wheelZoomFactor(e.deltaY));
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.target instanceof HTMLElement && e.target.closest(".radar-text-edit-wrap")) return;
      const calNow = calRef.current;
      const { x, y } = pos(e);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const toolNow = toolRef.current;
      const rnd = currentRound(replayRef.current, tickRef.current);
      const tickNow = tickRef.current;
      const tps = tickRate(replayRef.current);
      const ctx = canvasRef.current?.getContext("2d");

      if (toolNow === "eraser" && calNow) {
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        onNoteRef.current(
          eraseAt(noteRef.current, world, { x, y }, toScreen, ctx ?? null, tickNow),
        );
        return;
      }

      if ((toolNow === "text" || toolNow === "pan") && calNow && ctx) {
        const hit = findTextRef(ctx, noteRef.current, tickNow, toScreen, x, y);
        if (hit) {
          const st = drawingFromRef(noteRef.current, hit);
          if (st?.type === "text") {
            const world = screenToWorld(calNow, w, h, view.current, x, y);
            suppressClickRef.current = true;
            textMoveRef.current = {
              ref: hit,
              grabWx: world.x,
              grabWy: world.y,
              grabSx: x,
              grabSy: y,
              origX: st.x,
              origY: st.y,
              x: st.x,
              y: st.y,
              moved: false,
            };
            return;
          }
        }
      }

      if (toolNow === "bookmark") {
        e.preventDefault();
        onPauseRef.current();
        onNoteRef.current(
          addBookmark(
            noteRef.current,
            makeBookmark(colorRef.current, tickNow, momentRef.current, rnd?.end_tick ?? 0, tps),
          ),
        );
        return;
      }

      if (toolNow === "text") {
        if (!calNow) return;
        e.preventDefault();
        onPauseRef.current();
        commitEditingRef.current();
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const next: TextEdit = {
          ref: null,
          x: world.x,
          y: world.y,
          sx: x,
          sy: y,
          text: "",
          color: colorRef.current,
        };
        const stamped = withMoment(
          {
            type: "text" as const,
            color: next.color,
            x: next.x,
            y: next.y,
            text: "",
          } satisfies Drawing,
          momentRef.current,
          tickNow,
          rnd?.end_tick ?? 0,
          tps,
        );
        if (stamped.start_tick != null) {
          next.start_tick = stamped.start_tick;
          next.end_tick = stamped.end_tick;
        }
        beginEditingRef.current(next);
        return;
      }

      if (toolNow === "pen" || toolNow === "arrow") {
        if (!calNow) return;
        view.current.drawing = true;
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const base =
          toolNow === "pen"
            ? beginPen(colorRef.current, world)
            : beginArrow(colorRef.current, world);
        draft.current = withMoment(base, momentRef.current, tickNow, rnd?.end_tick ?? 0, tps);
        penTip.current = toolNow === "pen" ? world : null;
        return;
      }

      view.current.dragging = true;
      view.current.dragged = false;
      view.current.lx = e.clientX;
      view.current.ly = e.clientY;
    };

    const onMove = (e: MouseEvent) => {
      const calNow = calRef.current;
      const wrapEl = wrapRef.current;
      const edDrag = editDragRef.current;
      const ed = editingRef.current;
      if (edDrag && ed && calNow && wrapEl) {
        const { x, y } = pos(e);
        const sx = edDrag.origSx + (x - edDrag.grabX);
        const sy = edDrag.origSy + (y - edDrag.grabY);
        const world = screenToWorld(
          calNow,
          wrapEl.clientWidth,
          wrapEl.clientHeight,
          view.current,
          sx,
          sy,
        );
        ed.x = world.x;
        ed.y = world.y;
        ed.sx = sx;
        ed.sy = sy;
        const box = editWrapRef.current;
        if (box) {
          box.style.left = `${sx}px`;
          box.style.top = `${sy}px`;
        }
        return;
      }
      const moving = textMoveRef.current;
      if (moving && calNow && wrapEl) {
        const { x, y } = pos(e);
        if (!moving.moved) {
          if (Math.hypot(x - moving.grabSx, y - moving.grabSy) < NOTE_TEXT_DRAG_PX) return;
          moving.moved = true;
        }
        const world = screenToWorld(
          calNow,
          wrapEl.clientWidth,
          wrapEl.clientHeight,
          view.current,
          x,
          y,
        );
        moving.x = moving.origX + (world.x - moving.grabWx);
        moving.y = moving.origY + (world.y - moving.grabWy);
        return;
      }
      if (view.current.drawing && draft.current && calNow) {
        const wrapNow = wrapRef.current;
        if (!wrapNow) return;
        const { x, y } = pos(e);
        const world = screenToWorld(
          calNow,
          wrapNow.clientWidth,
          wrapNow.clientHeight,
          view.current,
          x,
          y,
        );
        if (draft.current.type === "pen") penTip.current = world;
        draft.current = extendDraft(draft.current, world);
        return;
      }
      if (!view.current.dragging) return;
      const dx = e.clientX - view.current.lx;
      const dy = e.clientY - view.current.ly;
      if (!view.current.dragged && dx * dx + dy * dy < 16) return;
      if (!view.current.dragged) {
        view.current.dragged = true;
        onPanRef.current();
      }
      view.current.ox += dx;
      view.current.oy += dy;
      view.current.lx = e.clientX;
      view.current.ly = e.clientY;
    };

    const editTextAt = (ref: NonNullable<TextEdit["ref"]>) => {
      const st = drawingFromRef(noteRef.current, ref);
      if (st?.type !== "text") return;
      const calNow = calRef.current;
      if (!calNow) return;
      const s = toScreen(st.x, st.y);
      suppressClickRef.current = true;
      onPauseRef.current();
      commitEditingRef.current();
      beginEditingRef.current({
        ref,
        x: st.x,
        y: st.y,
        sx: s.x,
        sy: s.y,
        text: st.text,
        color: st.color,
        start_tick: st.start_tick,
        end_tick: st.end_tick,
        box_w: st.box_w,
        box_h: st.box_h,
      });
    };

    const onUp = () => {
      if (editDragRef.current) {
        editDragRef.current = null;
        const ed = editingRef.current;
        if (ed) setEditing({ ...ed });
        ignoreBlurRef.current = false;
        focusEditor();
      }
      const moving = textMoveRef.current;
      if (moving) {
        textMoveRef.current = null;
        if (moving.moved) {
          onNoteRef.current(
            moveDrawingAt(
              noteRef.current,
              moving.ref,
              moving.x - moving.origX,
              moving.y - moving.origY,
            ),
          );
        } else {
          editTextAt(moving.ref);
        }
      }
      if (view.current.drawing && draft.current) {
        let drawing = draft.current;
        if (drawing.type === "pen") {
          const tip = penTip.current;
          if (tip) drawing = extendDraft(drawing, tip);
          const committed = commitDraft(drawing);
          if (!committed || committed.type !== "pen") {
            draft.current = null;
            penTip.current = null;
            view.current.drawing = false;
            return;
          }
          onNoteRef.current(
            addDrawing(noteRef.current, { ...committed, points: simplifyStroke(committed.points) }),
          );
        } else {
          const committed = commitDraft(drawing);
          if (committed) onNoteRef.current(addDrawing(noteRef.current, committed));
        }
        draft.current = null;
        penTip.current = null;
      }
      view.current.drawing = false;
      view.current.dragging = false;
    };

    const onDblClick = (e: MouseEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest(".radar-text-edit-wrap")) return;
      if (toolRef.current === "eraser") return;
      const calNow = calRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (!calNow || !ctx) return;
      const { x, y } = pos(e);
      const hit = findTextRef(ctx, noteRef.current, tickRef.current, toScreen, x, y);
      if (!hit) return;
      editTextAt(hit);
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("mousedown", onDown);
    wrap.addEventListener("dblclick", onDblClick);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("mousedown", onDown);
      wrap.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pointer handlers read latest refs
  }, []);
}
