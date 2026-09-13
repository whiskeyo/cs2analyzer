import { useEffect, useRef } from "react";
import { canvasInputsChanged, useCanvasLoop } from "@/lib/shared/useCanvasLoop";
import { type Drawing, type FloorMode, type NadeStyle, type Note } from "@/lib/notes/types";
import { defaultPlaybookColor } from "@/lib/playbook/pages";
import { paintPlaybookBoard, playbookUsesLower } from "@/lib/playbook/paint";
import { playbookToolCursor, type PlaybookTool } from "@/lib/playbook/pieces";
import type { NadeTrailDraft } from "@/lib/playbook/nadeTrail";
import { playbookImageFilesFromList } from "@/lib/playbook/images";
import { createPlaybookView, usePlaybookPointer } from "@/lib/playbook/pointer";
import type { LegendEntry } from "@/lib/playbook/legend";
import type { PlaybookImage, PlaybookYouTube } from "@/lib/playbook/types";
import { nadeIconLoadCount } from "@/lib/radar/draw";
import { screenToWorld } from "@/lib/radar/maps";
import { useRadarImages } from "@/lib/radar/useRadarImages";
import { wrapLocalPoint } from "@/lib/shared/pointer";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";

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
  pageImages?: readonly PlaybookImage[];
  selectedImageId?: string | null;
  onNote?: (note: Note) => void;
  onSelect?: (id: string | null) => void;
  onVideos?: (videos: PlaybookYouTube[]) => void;
  onImages?: (images: PlaybookImage[]) => void;
  onDropImages?: (files: File[], at: { x: number; y: number }) => void;
  onOpenImage?: (id: string) => void;
  onOpenVideo?: (id: string) => void;
  onPlaceYouTube?: (at: { x: number; y: number }) => void;
  radarGray?: number;
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
    pageImages = [],
    onNote,
    onSelect,
    onVideos,
    onImages,
    onDropImages,
    onOpenImage,
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
  const pageImagesRef = useRef(pageImages);
  pageImagesRef.current = pageImages;
  const openImageIdRef = useRef(props.selectedImageId ?? null);
  openImageIdRef.current = props.selectedImageId ?? null;
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
    imagesRef: pageImagesRef,
    openImageIdRef,
    onNote,
    onSelect,
    onVideos,
    onImages,
    onOpenImage,
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
        p.radarGray ?? DEFAULT_RADAR_GRAY,
        p.pageImages ?? [],
        p.selectedImageId ?? null,
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
        p.pageImages,
        p.selectedImageId ?? null,
        images.current.upper,
        images.current.lower,
        c4Icon.current,
        nadeIconLoadCount(nadeIcons.current),
        p.radarGray ?? DEFAULT_RADAR_GRAY,
      ]);
    },
  );

  return (
    <div
      className="radar-wrap"
      ref={wrapRef}
      style={{ cursor: playbookToolCursor(tool, nadeTrail) }}
      onDragOver={(event) => {
        if (!onDropImages) return;
        if ([...event.dataTransfer.types].includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!onDropImages) return;
        const files = playbookImageFilesFromList(event.dataTransfer.files);
        if (files.length === 0) return;
        event.preventDefault();
        const wrap = wrapRef.current;
        const calNow = calRef.current;
        if (!wrap || !calNow) {
          onDropImages(files, { x: 0, y: 0 });
          return;
        }
        const { x, y } = wrapLocalPoint(wrap, event);
        onDropImages(
          files,
          screenToWorld(calNow, wrap.clientWidth, wrap.clientHeight, view.current, x, y),
        );
      }}
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
