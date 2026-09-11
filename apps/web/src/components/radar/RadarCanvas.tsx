import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { canvasInputsChanged, useCanvasLoop } from "@/lib/shared/useCanvasLoop";
import { applyRadarFollowCam, radarPaintInputs } from "@/lib/radar/radarPaintDirty";
import type { MouseEvent as ReactMouseEvent } from "react";
import { worldToScreen } from "@/lib/radar/maps";
import { buildRadarFrame } from "@/lib/radar/radarFrame";
import {
  paintPawns,
  paintRadarFrame,
  paintViewCone,
  paintHabitsOverlay,
} from "@/lib/radar/paintRadarFrame";
import { paintMapImage, paintNote } from "@/lib/radar/staticMapPaint";
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
import { NOTE_MOMENT_SECONDS } from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import {
  RADAR_TOOL_CURSOR,
  type DrawTool,
  type Drawing,
  type FloorMode,
  type MapLayers,
  type Note,
  type SummaryFilter,
} from "@/lib/notes/types";

interface Props {
  replay: Replay;
  tick: number;
  /** Live playhead. When set, rAF / pointer read this instead of React `tick`. */
  tickRef?: MutableRefObject<number>;
  cal: MapCalibration | undefined;
  selected: number | null;
  onSelect: (index: number | null) => void;
  follow: boolean;
  trails: boolean;
  tool: DrawTool;
  color: string;
  note: Note;
  onNote: (next: Note) => void;
  onPan: () => void;
  onPause: () => void;
  moment: boolean;
  momentSec?: number;
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
  const {
    replay,
    tick,
    cal,
    tool,
    color,
    note,
    onNote,
    onPan,
    onPause,
    moment,
    momentSec = NOTE_MOMENT_SECONDS,
    viewEpoch,
  } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const fallbackTickRef = useRef(tick);
  if (!props.tickRef) {
    fallbackTickRef.current = tick;
  }
  const tickRef = props.tickRef ?? fallbackTickRef;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const noteRef = useRef(note);
  noteRef.current = note;
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const momentRef = useRef(moment);
  momentRef.current = moment;
  const momentSecRef = useRef(momentSec);
  momentSecRef.current = momentSec;
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
  const draft = useRef<Drawing | null>(null);
  const penTip = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const textMoveRef = useRef<TextMove | null>(null);
  const lastPaintInputs = useRef<readonly unknown[] | null>(null);
  const notes = useTextNotes(noteRef, onNote);
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
      const tickNow = p.tickRef?.current ?? p.tick;
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

      paintNote(ctx, noteRef.current, toScreen, {
        tick: tickNow,
        skipText: editingRef.current?.ref,
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
    (w, h) => {
      const p = propsRef.current;
      const v = view.current;
      const tickNow = p.tickRef?.current ?? p.tick;
      applyRadarFollowCam(v, w, h, p.replay, tickNow, p.selected, p.follow, p.cal);
      const move = textMoveRef.current;
      const ed = editingRef.current;
      return canvasInputsChanged(
        lastPaintInputs,
        radarPaintInputs({
          tick: tickNow,
          view: v,
          layers: p.layers,
          summaryFilter: p.summaryFilter,
          note: noteRef.current,
          draft: draft.current,
          playSec: p.habitsPlaySecRef?.current,
          follow: p.follow,
          selected: p.selected,
          trails: p.trails,
          floorMode: p.floorMode,
          habitsOnly: p.habitsOnly ?? false,
          habitsOverlay: p.habitsOverlay,
          habitsOverlayDisplay: p.habitsOverlayDisplay,
          habitsShowTrails: p.habitsShowTrails ?? false,
          habitsShowArrows: p.habitsShowArrows ?? true,
          habitsNadesOn: p.habitsNadesOn ?? true,
          habitsNadeOpacity: p.habitsNadeOpacity ?? 0.4,
          habitsNadeFilter: p.habitsNadeFilter,
          cal: p.cal,
          replay: p.replay,
          viewEpoch: p.viewEpoch,
          imgUpper: images.current.upper,
          imgLower: images.current.lower,
          c4: c4Icon.current,
          nadeIcons: nadeIcons.current,
          textMoveX: move?.x ?? null,
          textMoveY: move?.y ?? null,
          editing: ed != null,
          skipText: ed?.ref ?? null,
          editX: ed?.x ?? null,
          editY: ed?.y ?? null,
        }),
      );
    },
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
    momentSecRef,
    noteRef,
    onNoteRef,
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
    const players = samplePlayers(p.replay, p.tickRef?.current ?? p.tick);
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
