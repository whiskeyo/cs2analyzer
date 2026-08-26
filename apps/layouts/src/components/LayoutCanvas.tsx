import type { MouseEvent, WheelEvent, RefObject } from "react";
import { useEffect, useRef } from "react";
import { polygonCentroid } from "@/lib/geometry";
import { calloutColor } from "@/lib/layout";
import { radarFile, radarLayout, radarToScreen, type RadarView } from "@/lib/maps";
import type { LayoutCallout, LayoutDraft, LayoutFloor, MapCalibration, Point } from "@/lib/types";
import type { LayoutTool, PanView } from "@/lib/useLayoutPointer";

interface Props {
  cal: MapCalibration;
  floor: LayoutFloor;
  tool: LayoutTool;
  callouts: LayoutCallout[];
  selectedId: string | null;
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
  selectedId,
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
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
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
      ctx.clearRect(0, 0, w, h);
      const v = view.current as RadarView;
      const { fit, baseX, baseY } = radarLayout(w, h, v);
      const img = imageRef.current;
      if (img) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, baseX, baseY, fit * v.scale, fit * v.scale);
      } else {
        ctx.fillStyle = "#12171d";
        ctx.fillRect(baseX, baseY, fit * v.scale, fit * v.scale);
      }

      const toScreen = (p: Point) => radarToScreen(w, h, v, p.x, p.y);
      const floorNow = floorRef.current;
      const selectedNow = selectedIdRef.current;

      for (const callout of calloutsRef.current) {
        if (callout.floor !== floorNow) continue;
        const selected = callout.id === selectedNow;
        const color = calloutColor(callout.id);
        const pts = callout.polygon;
        if (pts.length < 1) continue;
        const first = toScreen(pts[0]!);
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < pts.length; i++) {
          const s = toScreen(pts[i]!);
          ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = selected ? 0.38 : 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = selected ? 2.4 : 1.5;
        ctx.stroke();
        const c = toScreen(polygonCentroid(pts));
        ctx.font = "bold 12px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#12181f";
        ctx.fillStyle = color;
        ctx.strokeText(callout.name, c.x, c.y);
        ctx.fillText(callout.name, c.x, c.y);
        if (selected) {
          for (const p of pts) {
            const s = toScreen(p);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = "#0b0e12";
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }

      const draft = draftRef.current;
      if (draft) {
        const color = "#e8eef4";
        ctx.strokeStyle = color;
        ctx.fillStyle = "rgba(232, 238, 244, 0.12)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        if (draft.kind === "polygon") {
          const pts = draft.points;
          if (pts.length > 0) {
            ctx.beginPath();
            const origin = toScreen(pts[0]!);
            ctx.moveTo(origin.x, origin.y);
            for (let i = 1; i < pts.length; i++) {
              const s = toScreen(pts[i]!);
              ctx.lineTo(s.x, s.y);
            }
            const cursor = cursorRef.current;
            if (cursor) {
              const s = toScreen(cursor);
              ctx.lineTo(s.x, s.y);
            }
            ctx.stroke();
            for (const p of pts) {
              const s = toScreen(p);
              ctx.beginPath();
              ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
              ctx.setLineDash([]);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.setLineDash([5, 4]);
            }
          }
        } else if (draft.kind === "rect") {
          const a = toScreen(draft.start);
          const b = toScreen(draft.end);
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const wBox = Math.abs(b.x - a.x);
          const hBox = Math.abs(b.y - a.y);
          ctx.beginPath();
          ctx.rect(x, y, wBox, hBox);
          ctx.fill();
          ctx.stroke();
        } else {
          const c = toScreen(draft.start);
          const e = toScreen(draft.end);
          const radius = Math.hypot(e.x - c.x, e.y - c.y);
          ctx.beginPath();
          ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

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
