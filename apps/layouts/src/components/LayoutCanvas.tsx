import type { MouseEvent, WheelEvent, RefObject } from "react";
import { useEffect, useRef } from "react";
import { paintLayoutFrame } from "@/lib/paintLayout";
import { radarFile, radarLayout, radarToScreen, type RadarView } from "@/lib/maps";
import type { LayoutCallout, LayoutDraft, LayoutFloor, MapCalibration, Point } from "@/lib/types";
import type { LayoutTool, PanView } from "@/lib/useLayoutPointer";

interface Props {
  cal: MapCalibration;
  floor: LayoutFloor;
  tool: LayoutTool;
  callouts: LayoutCallout[];
  selectedIds: string[];
  wrapRef: RefObject<HTMLDivElement | null>;
  view: RefObject<PanView>;
  draftRef: RefObject<LayoutDraft | null>;
  cursorRef: RefObject<Point | null>;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: (e: MouseEvent<HTMLDivElement>) => void;
  onWheel: (e: WheelEvent<HTMLDivElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
}

export function LayoutCanvas({
  cal,
  floor,
  tool,
  callouts,
  selectedIds,
  wrapRef,
  view,
  draftRef,
  cursorRef,
  onMouseDown,
  onDoubleClick,
  onWheel,
  onContextMenu,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const calloutsRef = useRef(callouts);
  calloutsRef.current = callouts;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const floorRef = useRef(floor);
  floorRef.current = floor;

  useEffect(() => {
    const img = new Image();
    img.src = `/maps/${radarFile(cal, floor)}`;
    img.onload = () => {
      imageRef.current = img;
    };
    imageRef.current = null;
  }, [cal, floor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = view.current as RadarView;
      const { fit, baseX, baseY } = radarLayout(w, h, v);
      paintLayoutFrame(ctx, {
        w,
        h,
        view: v,
        floor: floorRef.current,
        callouts: calloutsRef.current,
        selectedIds: selectedIdsRef.current,
        draft: draftRef.current,
        cursor: cursorRef.current,
        image: imageRef.current,
        toScreen: (p) => radarToScreen(w, h, v, p.x, p.y),
        fit,
        baseX,
        baseY,
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cursorRef, draftRef, view, wrapRef]);

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap tool-${tool}`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
