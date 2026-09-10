import { useEffect, useRef } from "react";
import { canvasInputsChanged, useCanvasLoop } from "@/lib/shared/useCanvasLoop";
import { type Drawing, type FloorMode, type NadeStyle, type Note } from "@/lib/notes/types";
import { defaultPlaybookColor } from "@/lib/playbook/pages";
import { paintPlaybookBoard, playbookUsesLower } from "@/lib/playbook/paint";
import { playbookToolCursor, type PlaybookTool } from "@/lib/playbook/pieces";
import type { NadeTrailDraft } from "@/lib/playbook/nadeTrail";
import { createPlaybookView, usePlaybookPointer } from "@/lib/playbook/pointer";
import type { LegendEntry } from "@/lib/playbook/legend";
import type { PlaybookYouTube } from "@/lib/playbook/types";
import { nadeIconLoadCount } from "@/lib/radar/draw";
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
  videos?: readonly PlaybookYouTube[];
  selectedVideoId?: string | null;
  pendingPin?: { x: number; y: number } | null;
  onNote?: (note: Note) => void;
  onSelect?: (id: string | null) => void;
  onVideos?: (videos: PlaybookYouTube[]) => void;
  onOpenVideo?: (id: string) => void;
  onPlaceYouTube?: (at: { x: number; y: number }) => void;
}

export function PlaybookCanvas(props: Props) {
  const {
    cal,
    note,
    tool = "pan",
    color = defaultPlaybookColor(),
    nadeTrail = false,
    nadeStyle = "icon",
    viewEpoch = 0,
    legend = [],
    videos = [],
    onNote,
    onSelect,
    onVideos,
    onOpenVideo,
    onPlaceYouTube,
  } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef(createPlaybookView());
  const calRef = useRef(cal);
  calRef.current = cal;
  const noteRef = useRef(note);
  noteRef.current = note;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const draftRef = useRef<Drawing | null>(null);
  const gizmoRef = useRef<string | null>(null);
  const nadeTrailOnRef = useRef(nadeTrail);
  nadeTrailOnRef.current = nadeTrail;
  const nadeStyleRef = useRef(nadeStyle);
  nadeStyleRef.current = nadeStyle;
  const nadeTrailRef = useRef<NadeTrailDraft | null>(null);
  const videosRef = useRef(videos);
  videosRef.current = videos;
  const lastPaintInputs = useRef<readonly unknown[] | null>(null);
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
    videosRef,
    onNote,
    onSelect,
    onVideos,
    onOpenVideo,
    onPlaceYouTube,
  });

  useCanvasLoop(
    canvasRef,
    wrapRef,
    (ctx, w, h) => {
      ctx.fillStyle = "#0b0e12";
      ctx.fillRect(0, 0, w, h);
      const p = propsRef.current;
      const useLower = playbookUsesLower(p.cal, p.floorMode);
      const img = useLower ? images.current.lower : images.current.upper;
      paintPlaybookBoard(
        ctx,
        w,
        h,
        view.current,
        img,
        p.cal,
        p.note,
        draftRef.current,
        { c4: c4Icon.current, nades: nadeIcons.current },
        p.selectedId ?? null,
        gizmoRef.current,
        nadeTrailRef.current,
        p.videos ?? [],
        p.selectedVideoId ?? null,
        p.pendingPin ?? null,
      );
    },
    [cal],
    () => {
      const p = propsRef.current;
      const v = view.current;
      const trail = nadeTrailRef.current;
      return canvasInputsChanged(lastPaintInputs, [
        p.cal,
        p.floorMode,
        p.note,
        p.selectedId ?? null,
        p.nadeStyle ?? "icon",
        p.nadeTrail ?? false,
        v.scale,
        v.ox,
        v.oy,
        draftRef.current,
        gizmoRef.current,
        trail,
        trail?.hover?.x ?? null,
        trail?.hover?.y ?? null,
        trail?.points.length ?? 0,
        p.videos,
        p.selectedVideoId ?? null,
        p.pendingPin?.x ?? null,
        p.pendingPin?.y ?? null,
        images.current.upper,
        images.current.lower,
        c4Icon.current,
        nadeIconLoadCount(nadeIcons.current),
      ]);
    },
  );

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
