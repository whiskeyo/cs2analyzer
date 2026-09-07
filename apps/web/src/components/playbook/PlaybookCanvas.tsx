import { useEffect, useRef } from "react";
import { RADAR_TOOL_CURSOR, type FloorMode, type Note } from "@/lib/notes/types";
import { paintPlaybookBoard, playbookUsesLower } from "@/lib/playbook/paint";
import { createPlaybookView, usePlaybookPointer } from "@/lib/playbook/pointer";
import { useRadarImages } from "@/lib/radar/useRadarImages";
import type { MapCalibration } from "@/lib/replay/replayTypes";

interface Props {
  cal: MapCalibration | undefined;
  floorMode: FloorMode;
  note: Note;
}

export function PlaybookCanvas({ cal, floorMode, note }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef(createPlaybookView());
  const calRef = useRef(cal);
  calRef.current = cal;
  const floorModeRef = useRef(floorMode);
  floorModeRef.current = floorMode;
  const noteRef = useRef(note);
  noteRef.current = note;
  const { images } = useRadarImages(cal);

  usePlaybookPointer({ wrapRef, view });

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
      ctx.fillStyle = "#0b0e12";
      ctx.fillRect(0, 0, w, h);
      const useLower = playbookUsesLower(calRef.current, floorModeRef.current);
      const img = useLower ? images.current.lower : images.current.upper;
      paintPlaybookBoard(ctx, w, h, view.current, img, calRef.current, noteRef.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rAF loop reads latest refs
  }, [cal]);

  return (
    <div className="radar-wrap" ref={wrapRef} style={{ cursor: RADAR_TOOL_CURSOR.pan }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
