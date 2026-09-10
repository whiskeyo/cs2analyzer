import { useEffect, useRef, type RefObject } from "react";
import { useCanvasLoop } from "@/lib/shared/useCanvasLoop";
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

export function RadarCanvas(props: Props) {
  const { replay, tick, cal, tool, color, strokes, onStrokes, onPan, onPause, moment, viewEpoch } =
    props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const onStrokesRef = useRef(onStrokes);
  onStrokesRef.current = onStrokes;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const momentRef = useRef(moment);
  momentRef.current = moment;
  const calRef = useRef(cal);
  calRef.current = cal;
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

  useCanvasLoop(
    canvasRef,
    wrapRef,
    (ctx, w, h) => {
      ctx.fillStyle = "#0b0e12";
      ctx.fillRect(0, 0, w, h);

      const p = propsRef.current;
      const tickNow = p.tick;
      const calNow = p.cal;
      const v = view.current;
      const frame = buildRadarFrame({
        replay: p.replay,
        tick: tickNow,
        layers: p.layers,
        summaryFilter: p.summaryFilter,
        selected: p.selected,
        trails: p.trails,
        floorMode: p.floorMode,
        cal: calNow,
        scale: v.scale,
        habitsOnly: p.habitsOnly ?? false,
      });

      if (p.follow && p.selected != null && calNow) {
        const pawn = frame.players.find((x) => x.index === p.selected && x.present);
        if (pawn) {
          const pad = 16;
          const fit = Math.min(w, h) - pad * 2;
          const r = {
            x: (pawn.x - calNow.pos_x) / calNow.scale,
            y: (calNow.pos_y - pawn.y) / calNow.scale,
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
      const habitsNow = p.habitsOverlay ?? null;
      if (habitsNow) {
        const playSec = p.habitsPlaySecRef?.current;
        paintHabitsOverlay(
          ctx,
          habitsNow,
          p.habitsOverlayDisplay ?? "trails",
          p.habitsNadeFilter ?? DEFAULT_HABITS_NADE_FILTER,
          toScreen,
          v.scale,
          {
            showTrails: p.habitsShowTrails ?? false,
            showArrows: p.habitsShowArrows ?? true,
            nadesOn: p.habitsNadesOn ?? true,
            nadeOpacity: p.habitsNadeOpacity ?? 0.4,
            playSec,
            cal: calNow,
            nadeIcons: nadeIcons.current,
          },
        );
      }

      paintNoteStrokes(ctx, p.strokes, toScreen, {
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
      paintPawns(ctx, frame, toScreen, p.layers.names, c4Icon.current);
      ctx.restore();
    },
    [replay],
  );

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
    const p = propsRef.current;
    if (p.habitsOverlay) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const calNow = p.cal;
    if (!canvas || !wrap || !calNow) {
      p.onSelect(null);
      return;
    }
    const { x: mx, y: my } = canvasLocalPoint(canvas, e.clientX, e.clientY);
    const players = samplePlayers(p.replay, p.tick);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const toScreen = (wx: number, wy: number) => worldToScreen(calNow, w, h, view.current, wx, wy);
    p.onSelect(nearestPlayerIndexAtScreen(players, mx, my, toScreen));
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current !== "pan") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const p = propsRef.current;
    const calNow = p.cal;
    if (!canvas || !wrap || !calNow || !p.onHabitsJump) return;
    const habitsNow = p.habitsOverlay;
    if (!habitsNow) return;
    const { x: mx, y: my } = canvasLocalPoint(canvas, e.clientX, e.clientY);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const toScreen = (wx: number, wy: number) => worldToScreen(calNow, w, h, view.current, wx, wy);
    const playSec = p.habitsPlaySecRef?.current;
    const jump = habitsJumpAtScreen(
      habitsNow,
      p.habitsShowArrows ?? true,
      mx,
      my,
      toScreen,
      playSec,
    );
    if (jump) {
      e.preventDefault();
      p.onHabitsJump(jump);
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
