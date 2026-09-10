import type { MouseEvent, WheelEvent, RefObject } from "react";
import { useEffect, useRef } from "react";
import { canvasInputsChanged, useCanvasLoop } from "@/lib/shared/useCanvasLoop";
import { paintLayoutFrame } from "@/lib/layouts/paintLayout";
import { radarFile, radarLayout, radarToScreen, type RadarView } from "@/lib/layouts/maps";
import type {
  LayoutCallout,
  LayoutDraft,
  LayoutFloor,
  MapCalibration,
  Point,
} from "@/lib/layouts/types";
import type { LayoutTool, PanView } from "@/lib/layouts/useLayoutPointer";

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

export function LayoutCanvas(props: Props) {
  const {
    cal,
    floor,
    tool,
    wrapRef,
    view,
    draftRef,
    cursorRef,
    onMouseDown,
    onDoubleClick,
    onWheel,
    onContextMenu,
  } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastPaintInputs = useRef<readonly unknown[] | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = `/maps/${radarFile(cal, floor)}`;
    img.onload = () => {
      imageRef.current = img;
    };
    imageRef.current = null;
  }, [cal, floor]);

  useCanvasLoop(
    canvasRef,
    wrapRef,
    (ctx, w, h) => {
      const p = propsRef.current;
      const v = p.view.current as RadarView;
      const { fit, baseX, baseY } = radarLayout(w, h, v);
      paintLayoutFrame(ctx, {
        w,
        h,
        view: v,
        floor: p.floor,
        callouts: p.callouts,
        selectedIds: p.selectedIds,
        draft: p.draftRef.current,
        cursor: p.cursorRef.current,
        image: imageRef.current,
        toScreen: (pt) => radarToScreen(w, h, v, pt.x, pt.y),
        fit,
        baseX,
        baseY,
      });
    },
    [wrapRef, view, draftRef, cursorRef],
    () => {
      const p = propsRef.current;
      const v = p.view.current;
      const cursor = p.cursorRef.current;
      const draft = p.draftRef.current;
      return canvasInputsChanged(lastPaintInputs, [
        p.cal,
        p.floor,
        p.callouts,
        p.selectedIds.join("\0"),
        v.scale,
        v.ox,
        v.oy,
        draft,
        cursor?.x ?? null,
        cursor?.y ?? null,
        imageRef.current,
      ]);
    },
  );

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
