import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { NOTE_TEXT_DRAG_PX, PEN_MIN_SAMPLE_DISTANCE, tickRate } from "../constants";
import { screenToWorld, worldToScreen, type RadarView } from "../maps";
import { overlayVisible, withMoment } from "../overlay";
import { findTextIndex, hitStroke, hitTextLabel } from "./draw";
import type { TextEdit, TextEditDrag, TextMove } from "./TextNoteEditor";
import { currentRound } from "../sample";
import { simplifyStroke } from "../strokes";
import type { DrawTool, MapCalibration, Replay, Stroke } from "../types";

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
  strokesRef: MutableRefObject<Stroke[]>;
  onStrokesRef: MutableRefObject<(next: Stroke[]) => void>;
  onPauseRef: MutableRefObject<() => void>;
  onPanRef: MutableRefObject<() => void>;
  draft: MutableRefObject<Stroke | null>;
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
    strokesRef,
    onStrokesRef,
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

    const pos = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      v.scale = Math.min(6, Math.max(0.4, v.scale * factor));
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
      const roundNow = rnd?.number ?? 0;
      const tickNow = tickRef.current;
      const tps = tickRate(replayRef.current);
      const ctx = canvasRef.current?.getContext("2d");

      if (toolNow === "eraser" && calNow) {
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const next = strokesRef.current.filter((st) => {
          if (st.round !== roundNow || !overlayVisible(st, tickNow, roundNow, strokesRef.current))
            return true;
          if (st.type === "text") {
            if (!ctx) return true;
            const s = worldToScreen(calNow, w, h, view.current, st.x, st.y);
            return !hitTextLabel(ctx, st, s, x, y);
          }
          return !hitStroke(st, world.x, world.y, 48);
        });
        onStrokesRef.current(next);
        return;
      }

      if ((toolNow === "text" || toolNow === "pan") && calNow && ctx) {
        const hit = findTextIndex(
          ctx,
          calNow,
          w,
          h,
          view.current,
          strokesRef.current,
          tickNow,
          roundNow,
          x,
          y,
        );
        if (hit >= 0) {
          const st = strokesRef.current[hit];
          if (st.type === "text") {
            const world = screenToWorld(calNow, w, h, view.current, x, y);
            suppressClickRef.current = true;
            textMoveRef.current = {
              index: hit,
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

      if (toolNow === "text") {
        if (!calNow) return;
        e.preventDefault();
        onPauseRef.current();
        commitEditingRef.current();
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const next: TextEdit = {
          index: null,
          x: world.x,
          y: world.y,
          sx: x,
          sy: y,
          text: "",
          color: colorRef.current,
          round: roundNow,
        };
        const stamped = withMoment(
          { type: "text", round: roundNow, color: next.color, x: next.x, y: next.y, text: "" },
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
        const base: Stroke =
          toolNow === "pen"
            ? { type: "pen", color: colorRef.current, round: roundNow, points: [world] }
            : { type: "arrow", color: colorRef.current, round: roundNow, from: world, to: world };
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
        const wrapEl = wrapRef.current;
        if (!wrapEl) return;
        const { x, y } = pos(e);
        const world = screenToWorld(
          calNow,
          wrapEl.clientWidth,
          wrapEl.clientHeight,
          view.current,
          x,
          y,
        );
        if (draft.current.type === "pen") {
          penTip.current = world;
          const last = draft.current.points[draft.current.points.length - 1];
          if (Math.hypot(world.x - last.x, world.y - last.y) >= PEN_MIN_SAMPLE_DISTANCE) {
            draft.current.points.push(world);
          }
        } else if (draft.current.type === "arrow") {
          draft.current.to = world;
        }
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

    const editTextAt = (index: number) => {
      const st = strokesRef.current[index];
      if (st?.type !== "text") return;
      const calNow = calRef.current;
      if (!calNow) return;
      const s = worldToScreen(
        calNow,
        wrap.clientWidth,
        wrap.clientHeight,
        view.current,
        st.x,
        st.y,
      );
      suppressClickRef.current = true;
      onPauseRef.current();
      commitEditingRef.current();
      beginEditingRef.current({
        index,
        x: st.x,
        y: st.y,
        sx: s.x,
        sy: s.y,
        text: st.text,
        color: st.color,
        round: st.round,
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
          onStrokesRef.current(
            strokesRef.current.map((s, i) =>
              i === moving.index && s.type === "text" ? { ...s, x: moving.x, y: moving.y } : s,
            ),
          );
        } else {
          editTextAt(moving.index);
        }
      }
      if (view.current.drawing && draft.current) {
        let st = draft.current;
        if (st.type === "pen") {
          const tip = penTip.current;
          if (tip) {
            const last = st.points[st.points.length - 1];
            if (Math.hypot(tip.x - last.x, tip.y - last.y) > 0) st.points.push(tip);
          }
          if (st.points.length < 2) {
            draft.current = null;
            penTip.current = null;
            view.current.drawing = false;
            return;
          }
          st = { ...st, points: simplifyStroke(st.points) };
        } else if (st.type !== "arrow") {
          draft.current = null;
          penTip.current = null;
          view.current.drawing = false;
          return;
        }
        onStrokesRef.current([...strokesRef.current, st]);
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
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const rnd = currentRound(replayRef.current, tickRef.current);
      const roundNow = rnd?.number ?? 0;
      const hit = findTextIndex(
        ctx,
        calNow,
        w,
        h,
        view.current,
        strokesRef.current,
        tickRef.current,
        roundNow,
        x,
        y,
      );
      if (hit < 0) return;
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
