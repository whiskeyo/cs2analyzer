import { useEffect, useRef } from "react";
import { type Drawing, type FloorMode, type NadeStyle, type Note } from "@/lib/notes/types";
import { defaultPlaybookColor } from "@/lib/playbook/pages";
import { paintPlaybookBoard, playbookUsesLower } from "@/lib/playbook/paint";
import { playbookToolCursor, type PlaybookTool } from "@/lib/playbook/pieces";
import type { NadeTrailDraft } from "@/lib/playbook/nadeTrail";
import { createPlaybookView, usePlaybookPointer } from "@/lib/playbook/pointer";
import type { LegendEntry } from "@/lib/playbook/legend";
import { useRadarImages } from "@/lib/radar/useRadarImages";
import type { MapCalibration } from "@/lib/replay/replayTypes";

interface Props {
  cal: MapCalibration | undefined;
  floorMode: FloorMode;
  note: Note;
  tool?: PlaybookTool;
  color?: string;
  selectedId?: string | null;
  nadeTrail?: boolean;
  nadeStyle?: NadeStyle;
  viewEpoch?: number;
  legend?: LegendEntry[];
  onNote?: (note: Note) => void;
  onSelect?: (id: string | null) => void;
}

export function PlaybookCanvas({
  cal,
  floorMode,
  note,
  tool = "pan",
  color = defaultPlaybookColor(),
  selectedId = null,
  nadeTrail = false,
  nadeStyle = "icon",
  viewEpoch = 0,
  legend = [],
  onNote,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef(createPlaybookView());
  const calRef = useRef(cal);
  calRef.current = cal;
  const floorModeRef = useRef(floorMode);
  floorModeRef.current = floorMode;
  const noteRef = useRef(note);
  noteRef.current = note;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const colorRef = useRef(color);
  colorRef.current = color;
  const draftRef = useRef<Drawing | null>(null);
  const gizmoRef = useRef<string | null>(null);
  const nadeTrailOnRef = useRef(nadeTrail);
  nadeTrailOnRef.current = nadeTrail;
  const nadeStyleRef = useRef(nadeStyle);
  nadeStyleRef.current = nadeStyle;
  const nadeTrailRef = useRef<NadeTrailDraft | null>(null);
  const { images, c4Icon, nadeIcons } = useRadarImages(cal);

  useEffect(() => {
    view.current = createPlaybookView();
  }, [viewEpoch]);

  useEffect(() => {
    if (!nadeTrail) nadeTrailRef.current = null;
  }, [nadeTrail]);

  usePlaybookPointer({
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
    onNote,
    onSelect,
  });

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
      paintPlaybookBoard(
        ctx,
        w,
        h,
        view.current,
        img,
        calRef.current,
        noteRef.current,
        draftRef.current,
        { c4: c4Icon.current, nades: nadeIcons.current },
        selectedIdRef.current,
        gizmoRef.current,
        nadeTrailRef.current,
      );
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rAF loop reads latest refs
  }, [cal]);

  return (
    <div
      className="radar-wrap"
      ref={wrapRef}
      style={{ cursor: playbookToolCursor(tool, nadeTrail) }}
    >
      <canvas ref={canvasRef} />
      {legend.length > 0 ? (
        <ul className="playbook-legend" aria-label="Player colours">
          {legend.map((entry) => (
            <li key={entry.label}>
              <span className="playbook-legend-swatch" style={{ background: entry.color }} />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
