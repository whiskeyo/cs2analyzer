import { useEffect, useRef, type RefObject } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { radarUrl, worldToScreen } from "@/lib/radar/maps";
import { publicUrl } from "@/lib/shared/publicUrl";
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
  habitsTrailAtScreen,
  type HabitsNadeFilter,
  type SeriesOverlay,
  type SeriesOverlayDisplay,
} from "@/lib/parse/seriesOverlay";
import { TextNoteEditor, useTextNotes, type TextMove } from "@/components/radar/TextNoteEditor";
import { useRadarPointer, type RadarPanView } from "@/lib/radar/useRadarPointer";
import { samplePlayers } from "@/lib/replay/sample";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import type { DrawTool, FloorMode, MapLayers, Stroke, SummaryFilter } from "@/lib/notes/types";

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
  habitsNadeFilter?: HabitsNadeFilter;
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
  habitsNadeFilter = DEFAULT_HABITS_NADE_FILTER,
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
  const habitsNadeFilterRef = useRef(habitsNadeFilter);
  habitsNadeFilterRef.current = habitsNadeFilter;
  const habitsPlaySecRefProp = useRef(habitsPlaySecRef);
  habitsPlaySecRefProp.current = habitsPlaySecRef;
  const habitsOnlyRef = useRef(habitsOnly);
  habitsOnlyRef.current = habitsOnly;
  const onHabitsJumpRef = useRef(onHabitsJump);
  onHabitsJumpRef.current = onHabitsJump;
  const images = useRef<{ upper: HTMLImageElement | null; lower: HTMLImageElement | null }>({
    upper: null,
    lower: null,
  });
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
  const c4Icon = useRef<HTMLImageElement | null>(null);
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
    const img = new Image();
    img.src = publicUrl("weapons/c4.svg");
    img.onload = () => {
      c4Icon.current = img;
    };
  }, []);

  useEffect(() => {
    images.current = { upper: null, lower: null };
    if (!cal) return;
    const up = new Image();
    up.src = radarUrl(cal.radar);
    up.onload = () => {
      images.current.upper = up;
    };
    if (cal.lower_radar) {
      const lo = new Image();
      lo.src = radarUrl(cal.lower_radar);
      lo.onload = () => {
        images.current.lower = lo;
      };
    }
  }, [cal]);

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
      paintRadarFrame(ctx, frame, toScreen, { scale: v.scale, c4Icon: c4Icon.current });
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
          playSec,
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
      paintPawns(ctx, frame, toScreen, layersRef.current.names);
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
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const calNow = calRef.current;
    if (!canvas || !wrap || !calNow) {
      onSelectRef.current(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const players = samplePlayers(replay, tickRef.current);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const toScreen = (wx: number, wy: number) => worldToScreen(calNow, w, h, view.current, wx, wy);
    const habitsNow = habitsOverlayRef.current;
    if (habitsNow && onHabitsJumpRef.current) {
      const playSec = habitsPlaySecRefProp.current?.current;
      const hit = habitsTrailAtScreen(
        habitsNow,
        habitsOverlayDisplayRef.current,
        mx,
        my,
        toScreen,
        14,
        playSec,
      );
      if (hit) {
        onHabitsJumpRef.current({ demoId: hit.demoId, jumpTick: hit.jumpTick });
        return;
      }
    }
    let best: { i: number; d: number } | null = null;
    for (const p of players) {
      if (!p.present) continue;
      const s = toScreen(p.x, p.y);
      const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
      if (!best || d < best.d) best = { i: p.index, d };
    }
    onSelectRef.current(best && best.d < 18 * 18 ? best.i : null);
  };

  const cursor =
    tool === "pan"
      ? "grab"
      : tool === "eraser"
        ? "cell"
        : tool === "bookmark"
          ? "pointer"
          : "crosshair";

  return (
    <div className="radar-wrap" ref={wrapRef} style={{ cursor }}>
      <canvas ref={canvasRef} onClick={onClick} />
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
