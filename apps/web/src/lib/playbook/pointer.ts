import { useEffect, type MutableRefObject, type RefObject } from "react";
import { zoomViewAtCursor, wheelZoomFactor } from "@/lib/radar/panZoom.ts";
import type { RadarView } from "@/lib/radar/maps";

export type PlaybookPanView = RadarView & {
  dragging: boolean;
  lx: number;
  ly: number;
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

export function usePlaybookPointer(opts: {
  wrapRef: RefObject<HTMLDivElement | null>;
  view: MutableRefObject<PlaybookPanView>;
}): void {
  const { wrapRef, view } = opts;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const pos = (e: MouseEvent | WheelEvent) => {
      const rect = wrap.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = pos(e);
      applyPlaybookWheel(view.current, wrap.clientWidth, wrap.clientHeight, x, y, e.deltaY);
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { x, y } = pos(e);
      beginPlaybookPan(view.current, x, y);
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = pos(e);
      movePlaybookPan(view.current, x, y);
    };

    const onUp = () => {
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
  }, [view, wrapRef]);
}
