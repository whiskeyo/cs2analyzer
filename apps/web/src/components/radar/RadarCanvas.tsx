import { useEffect, useRef, type RefObject } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { worldToScreen } from "@/lib/radar/maps";
import { buildRadarFrame } from "@/lib/radar/radarFrame";
import {
  paintPawns,
  paintRadarFrame,
  paintViewCone,
  paintHabitsOverlay,
} from "@/lib/radar/paintRadarFrame";
import { paintMapImage, paintNoteStrokes } from "@/lib/radar/staticMapPaint";
import {
  DEFAULT_HABITS_NADE_FILTER,
  type HabitsNadeFilter,
  type SeriesOverlay,
  type SeriesOverlayDisplay,
} from "@/lib/parse/seriesOverlay";
import {
  canvasLocalPoint,
  habitsJumpAtScreen,
  nearestPlayerIndexAtScreen,
} from "@/lib/radar/radarHits";
import { useRadarImages } from "@/lib/radar/useRadarImages";
import { TextNoteEditor, useTextNotes, type TextMove } from "@/components/radar/TextNoteEditor";
import { useRadarPointer, type RadarPanView } from "@/lib/radar/useRadarPointer";
import { samplePlayers } from "@/lib/replay/sample";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import {
  RADAR_TOOL_CURSOR,
  type DrawTool,
  type FloorMode,
  type MapLayers,
  type Stroke,
  type SummaryFilter,
} from "@/lib/notes/types";

interface Props {
  replay: Replay;
  tick: number;
  cal: MapCalibration | undefined;
  selected: number | null;
  onSelect: (index: number | null) => void;
  follow: boolean;
  trails: boolean;
  tool: DrawTool;
  color: string;
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
  onPan: () => void;
  onPause: () => void;
  moment: boolean;
  layers: MapLayers;
  summaryFilter: SummaryFilter;
  viewEpoch: number;
  floorMode: FloorMode;
  habitsOverlay?: SeriesOverlay | null;
  habitsOverlayDisplay?: SeriesOverlayDisplay;
  habitsShowTrails?: boolean;
  habitsShowArrows?: boolean;
  habitsNadeFilter?: HabitsNadeFilter;
  habitsNadesOn?: boolean;
  habitsNadeOpacity?: number;
  habitsPlaySecRef?: RefObject<number>;
  habitsOnly?: boolean;
  onHabitsJump?: (target: { demoId: string; jumpTick: number }) => void;
}

export function RadarCanvas({
  replay,
  tick,
  cal,
  selected,
  onSelect,
  follow,
  trails,
  tool,
  color,
  strokes,
  onStrokes,
  onPan,
  onPause,
  moment,
  layers,
  summaryFilter,
  viewEpoch,
  floorMode,
  habitsOverlay = null,
  habitsOverlayDisplay = "trails",
  habitsShowTrails = false,
  habitsShowArrows = true,
  habitsNadeFilter = DEFAULT_HABITS_NADE_FILTER,
  habitsNadesOn = true,
  habitsNadeOpacity = 0.4,
  habitsPlaySecRef,
  habitsOnly = false,
  onHabitsJump,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const followRef = useRef(follow);
  followRef.current = follow;
  const trailsRef = useRef(trails);
  trailsRef.current = trails;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const onStrokesRef = useRef(onStrokes);
  onStrokesRef.current = onStrokes;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const momentRef = useRef(moment);
  momentRef.current = moment;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const summaryFilterRef = useRef(summaryFilter);
  summaryFilterRef.current = summaryFilter;
  const floorModeRef = useRef(floorMode);
  floorModeRef.current = floorMode;
  const calRef = useRef(cal);
  calRef.current = cal;
  const habitsOverlayRef = useRef(habitsOverlay);
  habitsOverlayRef.current = habitsOverlay;
  const habitsOverlayDisplayRef = useRef(habitsOverlayDisplay);
  habitsOverlayDisplayRef.current = habitsOverlayDisplay;
  const habitsShowTrailsRef = useRef(habitsShowTrails);
  habitsShowTrailsRef.current = habitsShowTrails;
  const habitsShowArrowsRef = useRef(habitsShowArrows);
  habitsShowArrowsRef.current = habitsShowArrows;
  const habitsNadesOnRef = useRef(habitsNadesOn);
  habitsNadesOnRef.current = habitsNadesOn;
  const habitsNadeOpacityRef = useRef(habitsNadeOpacity);
  habitsNadeOpacityRef.current = habitsNadeOpacity;
  const habitsNadeFilterRef = useRef(habitsNadeFilter);
  habitsNadeFilterRef.current = habitsNadeFilter;
  const habitsPlaySecRefProp = useRef(habitsPlaySecRef);
  habitsPlaySecRefProp.current = habitsPlaySecRef;
  const habitsOnlyRef = useRef(habitsOnly);
  habitsOnlyRef.current = habitsOnly;
  const onHabitsJumpRef = useRef(onHabitsJump);
  onHabitsJumpRef.current = onHabitsJump;
  const { images, c4Icon, nadeIcons } = useRadarImages(cal);
  const view = useRef<RadarPanView>({
    scale: 1,
    ox: 0,
    oy: 0,
    dragging: false,
    dragged: false,
    drawing: false,
    lx: 0,
    ly: 0,
  });
  const draft = useRef<Stroke | null>(null);
  const penTip = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const textMoveRef = useRef<TextMove | null>(null);
  const notes = useTextNotes(strokesRef, onStrokes);
  const {
    editing,
    setEditing,
    editingRef,
    editAreaRef,
    editWrapRef,
    ignoreBlurRef,
    editDragRef,
    focusEditor,
    beginEditingRef,
    commitEditingRef,
  } = notes;

  useEffect(() => {
    view.current.scale = 1;
    view.current.ox = 0;
    view.current.oy = 0;
  }, [viewEpoch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0b0e12";
      ctx.fillRect(0, 0, w, h);

      const tickNow = tickRef.current;
      const calNow = calRef.current;
      const v = view.current;
      const frame = buildRadarFrame({
        replay,
        tick: tickNow,
        layers: layersRef.current,
        summaryFilter: summaryFilterRef.current,
        selected: selectedRef.current,
        trails: trailsRef.current,
        floorMode: floorModeRef.current,
        cal: calNow,
        scale: v.scale,
        habitsOnly: habitsOnlyRef.current,
      });

      if (followRef.current && selectedRef.current != null && calNow) {
        const p = frame.players.find((x) => x.index === selectedRef.current && x.present);
        if (p) {
          const pad = 16;
          const fit = Math.min(w, h) - pad * 2;
          const r = {
            x: (p.x - calNow.pos_x) / calNow.scale,
            y: (calNow.pos_y - p.y) / calNow.scale,
          };
          v.ox = w / 2 - (w - fit) / 2 - (r.x / 1024) * fit * v.scale;
          v.oy = h / 2 - (h - fit) / 2 - (r.y / 1024) * fit * v.scale;
        }
      }

      const toScreen = (wx: number, wy: number) => worldToScreen(calNow, w, h, v, wx, wy);
      const img = frame.useLowerFloor ? images.current.lower : images.current.upper;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      paintMapImage(ctx, w, h, v, img, calNow);
      paintRadarFrame(ctx, frame, toScreen, {
        scale: v.scale,
        c4Icon: c4Icon.current,
        packC4Icon: c4Icon.current,
        nadeIcons: nadeIcons.current,
      });
      const habitsNow = habitsOverlayRef.current;
      if (habitsNow) {
        const playSec = habitsPlaySecRefProp.current?.current;
        paintHabitsOverlay(
          ctx,
          habitsNow,
          habitsOverlayDisplayRef.current,
          habitsNadeFilterRef.current,
          toScreen,
          v.scale,
          {
            showTrails: habitsShowTrailsRef.current,
            showArrows: habitsShowArrowsRef.current,
            nadesOn: habitsNadesOnRef.current,
            nadeOpacity: habitsNadeOpacityRef.current,
            playSec,
            cal: calNow,
            nadeIcons: nadeIcons.current,
          },
        );
      }

      paintNoteStrokes(ctx, strokesRef.current, toScreen, {
        tick: tickNow,
        round: frame.round?.number ?? 0,
        skipTextIndex: editingRef.current?.index,
        textMove: textMoveRef.current,
        draft: draft.current,
      });
      const ed = editingRef.current;
      const wrapBox = editWrapRef.current;
      if (ed && wrapBox && calNow) {
        const s = toScreen(ed.x, ed.y);
        wrapBox.style.left = `${s.x}px`;
        wrapBox.style.top = `${s.y}px`;
      }

      paintViewCone(ctx, frame, toScreen);
      paintPawns(ctx, frame, toScreen, layersRef.current.names, c4Icon.current);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rAF loop reads latest refs
  }, [replay]);

  useRadarPointer({
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
  });

  const onClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (toolRef.current !== "pan") return;
    if (view.current.dragged) return;
    if (habitsOverlayRef.current) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const calNow = calRef.current;
    if (!canvas || !wrap || !calNow) {
      onSelectRef.current(null);
      return;
    }
    const { x: mx, y: my } = canvasLocalPoint(canvas, e.clientX, e.clientY);
    const players = samplePlayers(replay, tickRef.current);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const toScreen = (wx: number, wy: number) => worldToScreen(calNow, w, h, view.current, wx, wy);
    onSelectRef.current(nearestPlayerIndexAtScreen(players, mx, my, toScreen));
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current !== "pan") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const calNow = calRef.current;
    if (!canvas || !wrap || !calNow || !onHabitsJumpRef.current) return;
    const habitsNow = habitsOverlayRef.current;
    if (!habitsNow) return;
    const { x: mx, y: my } = canvasLocalPoint(canvas, e.clientX, e.clientY);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const toScreen = (wx: number, wy: number) => worldToScreen(calNow, w, h, view.current, wx, wy);
    const playSec = habitsPlaySecRefProp.current?.current;
    const jump = habitsJumpAtScreen(
      habitsNow,
      habitsShowArrowsRef.current,
      mx,
      my,
      toScreen,
      playSec,
    );
    if (jump) {
      e.preventDefault();
      onHabitsJumpRef.current(jump);
    }
  };

  return (
    <div className="radar-wrap" ref={wrapRef} style={{ cursor: RADAR_TOOL_CURSOR[tool] }}>
      <canvas ref={canvasRef} onClick={onClick} onDoubleClick={onDoubleClick} />
      {editing && (
        <TextNoteEditor
          editing={editing}
          wrapRef={wrapRef}
          editWrapRef={editWrapRef}
          editAreaRef={editAreaRef}
          editingRef={editingRef}
          ignoreBlurRef={ignoreBlurRef}
          editDragRef={editDragRef}
          focusEditor={focusEditor}
          commitEditing={notes.commitEditing}
          onTextKeyDown={notes.onTextKeyDown}
          setEditing={setEditing}
        />
      )}
    </div>
  );
}
