import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  NOTE_TEXT_MAX_WIDTH,
  OPENING_ARROW_MAX_PX,
  PEN_MIN_SAMPLE_DISTANCE,
  tickRate,
} from "./constants";
import { radarFloor, radarUrl, screenToWorld, worldToScreen, type RadarView } from "./maps";
import { overlayVisible, withMoment } from "./overlay";
import { publicUrl } from "./publicUrl";
import {
  blindsAt,
  formatBlindLeft,
  firesAt,
  HIT_SECONDS,
  hitsAt,
  killLineEnds,
  lingerRemaining,
  nadeBurstSpan,
  nadeLandPos,
  nadePopTick,
  nadeVisibleEnd,
  nadesForSummary,
  NADE_COLORS,
  openingDuel,
  shortenSegment,
  TRACER_SECONDS,
} from "./radarFx";
import { currentRound, samplePlayers, sampleTrail } from "./sample";
import { activeBomb } from "./stats";
import { drawSmoothLine, simplifyStroke } from "./strokes";
import type {
  DrawTool,
  FloorMode,
  MapCalibration,
  MapLayers,
  Replay,
  Stroke,
  SummaryFilter,
} from "./types";

function yawToCanvas(yaw: number): number {
  // CS2 eye yaw 0 is +X, but the pawn forward used on radar is 180° from that.
  return ((-yaw + 180) * Math.PI) / 180;
}

function drawC4(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  icon: HTMLImageElement | null,
) {
  const r = 14;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#161208";
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#f5d76e";
  ctx.stroke();
  if (icon && icon.complete && icon.naturalWidth > 0) {
    const size = 18;
    ctx.drawImage(icon, at.x - size / 2, at.y - size / 2, size, size);
  } else {
    ctx.fillStyle = "#f5d76e";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C4", at.x, at.y);
  }
}

function drawHeBurst(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  color: string,
  progress: number,
  scale: number,
) {
  const t = Math.min(1, Math.max(0, progress));
  const zoom = Math.min(1.4, scale);
  const r = (12 + t * 22) * zoom;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28 * (1 - t);
  ctx.beginPath();
  ctx.arc(at.x, at.y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85 * (1 - t * 0.65);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.45 * (1 - t);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.9 * (1 - t * 0.5);
  ctx.lineWidth = 1.6;
  const spike = r + 6 * zoom;
  const inner = r * 0.35;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + t * 0.2;
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(a) * inner, at.y + Math.sin(a) * inner);
    ctx.lineTo(at.x + Math.cos(a) * spike, at.y + Math.sin(a) * spike);
    ctx.stroke();
  }
  ctx.restore();
}

function grenadePosAt(
  points: { tick: number; x: number; y: number; z: number }[],
  tick: number,
): { x: number; y: number } | null {
  if (points.length === 0) return null;
  if (tick <= points[0].tick) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (tick <= points[i].tick) {
      const a = points[i - 1];
      const b = points[i];
      const span = b.tick - a.tick;
      const t = span === 0 ? 1 : (tick - a.tick) / span;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return points[points.length - 1];
}

function drawCurvedArrow(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  width: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bulge = Math.min(16, len * 0.08);
  const cx = (a.x + b.x) / 2 - (dy / len) * bulge;
  const cy = (a.y + b.y) / 2 + (dx / len) * bulge;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, b.x, b.y);
  ctx.stroke();
  const ang = Math.atan2(b.y - cy, b.x - cx);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - 14 * Math.cos(ang - 0.4), b.y - 14 * Math.sin(ang - 0.4));
  ctx.lineTo(b.x - 14 * Math.cos(ang + 0.4), b.y - 14 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

const TEXT_PAD = 6;
const TEXT_LINE = 15;
const TEXT_FONT = "12px ui-sans-serif, system-ui";

function wrapNote(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    if (line.length > 0) out.push(line.trimEnd());
  }
  return out.length > 0 ? out : [""];
}

function textBox(
  ctx: CanvasRenderingContext2D,
  st: Extract<Stroke, { type: "text" }>,
  screen: { x: number; y: number },
): { x: number; y: number; w: number; h: number; lines: string[] } {
  ctx.font = TEXT_FONT;
  const lines = wrapNote(ctx, st.text, NOTE_TEXT_MAX_WIDTH);
  let inner = 24;
  for (const line of lines) {
    inner = Math.max(inner, ctx.measureText(line || " ").width);
  }
  const w = Math.min(NOTE_TEXT_MAX_WIDTH, inner) + TEXT_PAD * 2;
  const h = Math.max(1, lines.length) * TEXT_LINE + TEXT_PAD * 2;
  return { x: screen.x - w / 2, y: screen.y - h / 2, w, h, lines };
}

function drawTextLabel(
  ctx: CanvasRenderingContext2D,
  st: Extract<Stroke, { type: "text" }>,
  screen: { x: number; y: number },
) {
  const box = textBox(ctx, st, screen);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#12181f";
  ctx.strokeStyle = st.color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = st.color;
  ctx.font = TEXT_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.globalAlpha = 1;
  for (let i = 0; i < box.lines.length; i++) {
    ctx.fillText(box.lines[i], box.x + TEXT_PAD, box.y + TEXT_PAD + i * TEXT_LINE);
  }
  ctx.restore();
}

function hitTextLabel(
  ctx: CanvasRenderingContext2D,
  st: Extract<Stroke, { type: "text" }>,
  screen: { x: number; y: number },
  mx: number,
  my: number,
): boolean {
  const box = textBox(ctx, st, screen);
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

interface TextEdit {
  index: number | null;
  x: number;
  y: number;
  /** Wrap-local px so the first paint sits on the click, not after the canvas. */
  sx: number;
  sy: number;
  text: string;
  color: string;
  round: number;
  start_tick?: number;
  end_tick?: number;
}

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
  const images = useRef<{ upper: HTMLImageElement | null; lower: HTMLImageElement | null }>({
    upper: null,
    lower: null,
  });
  const view = useRef<
    RadarView & { dragging: boolean; dragged: boolean; lx: number; ly: number; drawing: boolean }
  >({
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
  const [editing, setEditing] = useState<TextEdit | null>(null);
  const editingRef = useRef<TextEdit | null>(null);
  editingRef.current = editing;
  const editAreaRef = useRef<HTMLTextAreaElement>(null);
  const ignoreBlurRef = useRef(false);

  const focusEditor = () => {
    const el = editAreaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const n = el.value.length;
    el.setSelectionRange(n, n);
  };

  useLayoutEffect(() => {
    if (!editing) return;
    focusEditor();
    const id = window.setTimeout(focusEditor, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keystrokes should not steal focus
  }, [editing?.index, editing?.x, editing?.y]);

  const commitEditingRef = useRef<() => void>(() => undefined);

  const commitEditing = () => {
    const ed = editingRef.current;
    if (!ed) return;
    editingRef.current = null;
    setEditing(null);
    const trimmed = ed.text.trim();
    const list = strokesRef.current;
    if (ed.index == null) {
      if (!trimmed) return;
      const st: Stroke = {
        type: "text",
        round: ed.round,
        color: ed.color,
        x: ed.x,
        y: ed.y,
        text: trimmed,
        ...(ed.start_tick != null ? { start_tick: ed.start_tick, end_tick: ed.end_tick } : {}),
      };
      onStrokesRef.current([...list, st]);
      return;
    }
    if (!trimmed) {
      onStrokesRef.current(list.filter((_, i) => i !== ed.index));
      return;
    }
    onStrokesRef.current(
      list.map((s, i) => (i === ed.index && s.type === "text" ? { ...s, text: trimmed } : s)),
    );
  };
  commitEditingRef.current = commitEditing;

  const beginEditingRef = useRef<(next: TextEdit) => void>(() => undefined);
  const beginEditing = (next: TextEdit) => {
    ignoreBlurRef.current = true;
    const clear = () => {
      ignoreBlurRef.current = false;
      window.removeEventListener("mouseup", clear);
      focusEditor();
    };
    window.addEventListener("mouseup", clear);
    editingRef.current = next;
    setEditing(next);
  };
  beginEditingRef.current = beginEditing;

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
      ctx.fillStyle = "#0d1116";
      ctx.fillRect(0, 0, w, h);

      const tickNow = tickRef.current;
      const calNow = calRef.current;
      const players = samplePlayers(replay, tickNow);
      const v = view.current;

      if (followRef.current && selectedRef.current != null && calNow) {
        const p = players.find((x) => x.index === selectedRef.current && x.present);
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

      const useLower =
        radarFloor(calNow, players, selectedRef.current, floorModeRef.current) === "lower";
      const img = useLower ? images.current.lower : images.current.upper;

      ctx.save();
      const pad = 16;
      const fit = Math.min(w, h) - pad * 2;
      const baseX = (w - fit) / 2 + v.ox;
      const baseY = (h - fit) / 2 + v.oy;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, baseX, baseY, fit * v.scale, fit * v.scale);
      } else if (!calNow) {
        ctx.fillStyle = "#1a222c";
        ctx.fillRect(baseX, baseY, fit * v.scale, fit * v.scale);
        ctx.fillStyle = "#8b98a5";
        ctx.font = "13px ui-sans-serif, system-ui";
        ctx.fillText("No radar for this map — showing world XY", pad, 24);
      }

      const ticksPerSecond = tickRate(replay);
      const layersNow = layersRef.current;

      if (layersNow.heatmap) {
        const focus = selectedRef.current;
        ctx.globalAlpha = 0.22;
        for (const k of replay.kills) {
          if (k.tick > tickNow) continue;
          if (focus != null && k.attacker !== focus && k.victim !== focus) continue;
          const s = toScreen(k.x, k.y);
          ctx.fillStyle =
            focus == null
              ? k.headshot
                ? "#ff8a8a"
                : "#c9a227"
              : k.attacker === focus
                ? "#ee6c4d"
                : "#5b9fd6";
          ctx.beginPath();
          ctx.arc(s.x, s.y, k.attacker === focus ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (layersNow.summary) {
        const zoom = Math.min(1.4, v.scale);
        for (const g of nadesForSummary(replay, summaryFilterRef.current)) {
          const land = nadeLandPos(g);
          if (!land) continue;
          const s = toScreen(land.x, land.y);
          const color = NADE_COLORS[g.kind] ?? "#fff";
          const radius =
            (g.kind === "smoke" ? 16 : g.kind === "molotov" ? 12 : g.kind === "he" ? 10 : 8) * zoom;
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      if (layersNow.grenades) {
        const round = currentRound(replay, tickNow);
        for (const g of replay.grenades) {
          if (round && (g.start_tick < round.start_tick || g.start_tick > round.end_tick)) {
            continue;
          }
          const color = NADE_COLORS[g.kind] ?? "#fff";
          const popAt = nadePopTick(g);
          const visibleEnd = nadeVisibleEnd(g, ticksPerSecond, round?.end_tick);
          const inFlight = tickNow >= g.start_tick && tickNow < popAt && tickNow <= visibleEnd;
          const lingering =
            tickNow >= popAt &&
            tickNow <= visibleEnd &&
            (g.kind === "smoke" || g.kind === "molotov" || g.kind === "decoy");
          const burstSpan = nadeBurstSpan(g.kind, ticksPerSecond);
          const burst =
            burstSpan > 0 &&
            tickNow >= popAt &&
            tickNow <= popAt + burstSpan &&
            tickNow <= visibleEnd;

          if (inFlight) {
            ctx.strokeStyle = color;
            ctx.lineWidth = g.kind === "he" ? 2.2 : 1.8;
            ctx.setLineDash(g.kind === "he" ? [6, 4] : []);
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            let started = false;
            for (const p of g.points) {
              if (p.tick > tickNow) break;
              const s = toScreen(p.x, p.y);
              if (!started) {
                ctx.moveTo(s.x, s.y);
                started = true;
              } else ctx.lineTo(s.x, s.y);
            }
            const head = grenadePosAt(g.points, tickNow);
            if (head) {
              const s = toScreen(head.x, head.y);
              if (started) ctx.lineTo(s.x, s.y);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 1;
              ctx.fillStyle = color;
              ctx.beginPath();
              if (g.kind === "he") {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(Math.PI / 4);
                ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
                ctx.restore();
              } else {
                ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            } else {
              ctx.stroke();
              ctx.setLineDash([]);
            }
          } else if (lingering || burst) {
            const occupancy = g.kind === "molotov" ? g.fires : undefined;
            const cells = g.kind === "molotov" ? firesAt(g.fires, tickNow) : [];
            if (lingering && cells.length > 0) {
              let cx = 0;
              let cy = 0;
              for (const cell of cells) {
                const s = toScreen(cell.x, cell.y);
                cx += s.x;
                cy += s.y;
              }
              cx /= cells.length;
              cy /= cells.length;
              const cellR = 8 * Math.min(1.4, v.scale);
              ctx.fillStyle = color;
              ctx.globalAlpha = 0.42;
              for (const cell of cells) {
                const s = toScreen(cell.x, cell.y);
                ctx.beginPath();
                ctx.arc(s.x, s.y, cellR, 0, Math.PI * 2);
                ctx.fill();
              }
              const left = lingerRemaining(popAt, visibleEnd, tickNow);
              const inner = Math.max(5, 6 * Math.min(1.4, v.scale));
              ctx.globalAlpha = 0.85;
              ctx.fillStyle = "#12181f";
              ctx.beginPath();
              ctx.arc(cx, cy, inner + 1.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 0.35;
              ctx.strokeStyle = color;
              ctx.lineWidth = 1.3;
              ctx.beginPath();
              ctx.arc(cx, cy, inner, 0, Math.PI * 2);
              ctx.stroke();
              if (left > 0) {
                ctx.globalAlpha = 0.95;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, inner, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
                ctx.closePath();
                ctx.fill();
              }
            } else if (lingering && occupancy && occupancy.length > 0) {
              // Molly occupancy was sampled but none is live — don't keep the envelope circle.
            } else {
              const last = g.points[g.points.length - 1];
              if (last) {
                const s = toScreen(last.x, last.y);
                const radius =
                  (g.kind === "smoke"
                    ? 32
                    : g.kind === "molotov"
                      ? 24
                      : g.kind === "he"
                        ? 18
                        : 12) * Math.min(1.4, v.scale);
                if (lingering && (g.kind === "smoke" || g.kind === "molotov")) {
                  const left = lingerRemaining(popAt, visibleEnd, tickNow);
                  const inner = Math.max(7, 8 * Math.min(1.4, v.scale));
                  ctx.fillStyle = color;
                  ctx.strokeStyle = color;
                  ctx.globalAlpha = 0.22;
                  ctx.beginPath();
                  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.globalAlpha = 0.4;
                  ctx.lineWidth = 1.4;
                  ctx.beginPath();
                  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
                  ctx.stroke();
                  ctx.globalAlpha = 0.85;
                  ctx.fillStyle = "#12181f";
                  ctx.beginPath();
                  ctx.arc(s.x, s.y, inner + 1.4, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.globalAlpha = 0.35;
                  ctx.strokeStyle = color;
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.arc(s.x, s.y, inner, 0, Math.PI * 2);
                  ctx.stroke();
                  if (left > 0) {
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.arc(s.x, s.y, inner, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
                    ctx.closePath();
                    ctx.fill();
                  }
                } else if (burst && g.kind === "he") {
                  const span = nadeBurstSpan("he", ticksPerSecond) || 1;
                  drawHeBurst(ctx, s, color, (tickNow - popAt) / span, v.scale);
                } else {
                  ctx.globalAlpha = burst ? 0.45 : 0.28;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      const tracerLife = ticksPerSecond * TRACER_SECONDS;
      if (layersNow.shots) {
        for (const sh of replay.shots) {
          const age = tickNow - sh.tick;
          if (age < 0 || age > tracerLife) continue;
          const origin = toScreen(sh.x, sh.y);
          const rad = yawToCanvas(sh.yaw);
          const dx = Math.cos(rad);
          const dy = Math.sin(rad);
          const fade = 1 - age / tracerLife;
          ctx.strokeStyle = "#ffe9a8";
          ctx.globalAlpha = fade * 0.28;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(origin.x + dx * 62, origin.y + dy * 62);
          ctx.stroke();
          ctx.globalAlpha = fade * 0.95;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(origin.x + dx * 48, origin.y + dy * 48);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      const bomb = activeBomb(replay, tickNow);
      if (bomb) {
        drawC4(ctx, toScreen(bomb.x, bomb.y), c4Icon.current);
      }

      if (layersNow.deaths) {
        const round = currentRound(replay, tickNow);
        if (round) {
          for (const k of replay.kills) {
            if (k.tick < round.freeze_end_tick || k.tick > tickNow || k.tick > round.end_tick) {
              continue;
            }
            const line = killLineEnds(replay, k);
            if (line) {
              const from = toScreen(line.from.x, line.from.y);
              const to = toScreen(line.to.x, line.to.y);
              ctx.strokeStyle = line.ct ? "#5b9fd6" : "#c9a227";
              ctx.globalAlpha = k.headshot ? 0.9 : 0.7;
              ctx.lineWidth = k.headshot ? 2 : 1.6;
              ctx.setLineDash([7, 5]);
              ctx.beginPath();
              ctx.moveTo(from.x, from.y);
              ctx.lineTo(to.x, to.y);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 0.85;
              ctx.beginPath();
              ctx.arc(from.x, from.y, 3, 0, Math.PI * 2);
              ctx.fillStyle = ctx.strokeStyle;
              ctx.fill();
            }
            const s = toScreen(k.x, k.y);
            ctx.strokeStyle = "#e04b4b";
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(s.x - 4, s.y - 4);
            ctx.lineTo(s.x + 4, s.y + 4);
            ctx.moveTo(s.x + 4, s.y - 4);
            ctx.lineTo(s.x - 4, s.y + 4);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      if (layersNow.openings) {
        const round = currentRound(replay, tickNow);
        if (round) {
          const opening = openingDuel(replay, round, tickNow);
          if (opening) {
            const line = killLineEnds(replay, opening);
            if (line) {
              const from = toScreen(line.from.x, line.from.y);
              const to = toScreen(line.to.x, line.to.y);
              const short = shortenSegment(from, to, OPENING_ARROW_MAX_PX);
              const color = line.ct ? "#5b9fd6" : "#ffd24a";
              ctx.globalAlpha = 1;
              drawCurvedArrow(ctx, short.from, short.to, color, 3.2);
              ctx.fillStyle = color;
              ctx.strokeStyle = "#12181f";
              ctx.lineWidth = 3;
              ctx.font = "bold 11px ui-sans-serif, system-ui";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.strokeText("FK", short.from.x, short.from.y - 8);
              ctx.fillText("FK", short.from.x, short.from.y - 8);
              ctx.strokeText("FD", to.x, to.y - 8);
              ctx.fillText("FD", to.x, to.y - 8);
            }
          }
        }
      }

      if (trailsRef.current) {
        const lookback = ticksPerSecond * 2.5;
        const ids =
          selectedRef.current != null ? [selectedRef.current] : players.map((p) => p.index);
        for (const id of ids) {
          const pts = sampleTrail(replay, id, tickNow, lookback);
          if (pts.length < 2) continue;
          const p = players.find((x) => x.index === id);
          ctx.strokeStyle = p?.ct ? "#5b9fd6" : "#c9a227";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          pts.forEach((pt, i) => {
            const s = toScreen(pt.x, pt.y);
            if (i === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      const drawStroke = (st: Stroke, alpha = 1, live = false) => {
        if (st.type === "text") {
          if (alpha < 1) return;
          drawTextLabel(ctx, st, toScreen(st.x, st.y));
          return;
        }
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = st.color;
        ctx.fillStyle = st.color;
        ctx.lineWidth = st.type === "arrow" ? 3.2 : 2.8;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        if (st.type === "pen") {
          const worldPts = live ? st.points : simplifyStroke(st.points);
          const pts = worldPts.map((pt) => toScreen(pt.x, pt.y));
          drawSmoothLine(ctx, pts);
        } else {
          const a = toScreen(st.from.x, st.from.y);
          const b = toScreen(st.to.x, st.to.y);
          drawCurvedArrow(ctx, a, b, st.color, 3.2);
        }
        ctx.globalAlpha = 1;
      };
      const roundNow = currentRound(replay, tickRef.current)?.number ?? 0;
      const tickDraw = tickRef.current;
      const skipText = editingRef.current?.index;
      strokesRef.current.forEach((st, i) => {
        if (!overlayVisible(st, tickDraw, roundNow, strokesRef.current)) return;
        if (st.type === "text" && skipText === i) return;
        drawStroke(st);
      });
      if (draft.current && overlayVisible(draft.current, tickDraw, roundNow, strokesRef.current)) {
        drawStroke(draft.current, 0.85, true);
      }
      const ed = editingRef.current;
      const area = editAreaRef.current;
      if (ed && area && calNow) {
        const s = toScreen(ed.x, ed.y);
        area.style.left = `${s.x}px`;
        area.style.top = `${s.y}px`;
      }

      if (layersNow.cone && selectedRef.current != null) {
        const p = players.find((x) => x.index === selectedRef.current && x.present && x.alive);
        if (p) {
          const s = toScreen(p.x, p.y);
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(yawToCanvas(p.yaw));
          ctx.fillStyle = p.ct ? "rgba(91,159,214,0.18)" : "rgba(201,162,39,0.18)";
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 78 * Math.min(1.6, v.scale), -0.55, 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      const blinds = blindsAt(replay.blinds, tickNow, ticksPerSecond);
      const hits = hitsAt(replay.hurts, tickNow, ticksPerSecond);
      for (const p of players) {
        if (!p.present) continue;
        const s = toScreen(p.x, p.y);
        const hit = hits.get(p.index);
        if (hit) {
          const t = Math.min(1, hit.age / HIT_SECONDS);
          const r = 9 + t * 14 + Math.min(hit.damage, 100) * 0.04;
          ctx.strokeStyle = "#e04b4b";
          ctx.fillStyle = "#e04b4b";
          ctx.globalAlpha = (1 - t) * 0.3;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 7 + (1 - t) * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        const flash = blinds.get(p.index);
        if (flash && p.alive) {
          const intensity = Math.min(1, flash / 1.4);
          const pulse = 13 + intensity * 6 + Math.sin((tickNow / ticksPerSecond) * 10) * 1.4;
          ctx.fillStyle = `rgba(255, 248, 200, ${0.12 + intensity * 0.38})`;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 11 + intensity * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 236, 150, ${0.45 + intensity * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      for (const p of players) {
        if (!p.present) continue;
        const s = toScreen(p.x, p.y);
        const color = p.ct ? "#5b9fd6" : "#c9a227";
        const flash = blinds.get(p.index) ?? 0;
        ctx.globalAlpha = p.alive ? 1 : 0.35;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(yawToCanvas(p.yaw));
        ctx.beginPath();
        const size = selectedRef.current === p.index ? 9 : 7;
        ctx.moveTo(size + 2, 0);
        ctx.lineTo(-size * 0.7, size * 0.7);
        ctx.lineTo(-size * 0.35, 0);
        ctx.lineTo(-size * 0.7, -size * 0.7);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        if (flash > 0 && p.alive) {
          ctx.fillStyle = `rgba(255, 252, 230, ${Math.min(0.88, 0.4 + flash * 0.35)})`;
          ctx.fill();
        }
        if (selectedRef.current === p.index) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.restore();

        if (p.alive && flash > 0) {
          ctx.fillStyle = NADE_COLORS.flash;
          ctx.font = "10px ui-sans-serif, system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(formatBlindLeft(flash), s.x + 12, s.y);
        }

        if (p.alive) {
          if (layersNow.names) {
            ctx.fillStyle = "#e8eef4";
            ctx.font = "11px ui-sans-serif, system-ui";
            ctx.textAlign = "center";
            const name = replay.players[p.index]?.name ?? "";
            ctx.fillText(name.slice(0, 12), s.x, s.y + 16);
          }
          ctx.fillStyle = p.health > 20 ? "#3dba6a" : "#e04b4b";
          ctx.fillRect(s.x - 10, s.y + 18, 20 * (p.health / 100), 3);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [replay]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const pos = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      v.scale = Math.min(6, Math.max(0.4, v.scale * factor));
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.target instanceof HTMLElement && e.target.closest(".radar-text-edit")) return;
      const calNow = calRef.current;
      const { x, y } = pos(e);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const toolNow = toolRef.current;
      const rnd = currentRound(replayRef.current, tickRef.current);
      const roundNow = rnd?.number ?? 0;
      const tickNow = tickRef.current;
      const tps = tickRate(replayRef.current);
      const ctx = canvasRef.current?.getContext("2d");

      if (toolNow === "eraser" && calNow) {
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const next = strokesRef.current.filter((st) => {
          if (st.round !== roundNow || !overlayVisible(st, tickNow, roundNow, strokesRef.current))
            return true;
          if (st.type === "text") {
            if (!ctx) return true;
            const s = worldToScreen(calNow, w, h, view.current, st.x, st.y);
            return !hitTextLabel(ctx, st, s, x, y);
          }
          return !hitStroke(st, world.x, world.y, 48);
        });
        onStrokesRef.current(next);
        return;
      }

      if (toolNow === "text") {
        if (!calNow) return;
        e.preventDefault();
        onPauseRef.current();
        commitEditingRef.current();
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        if (ctx) {
          for (let i = strokesRef.current.length - 1; i >= 0; i--) {
            const st = strokesRef.current[i];
            if (st.type !== "text" || !overlayVisible(st, tickNow, roundNow, strokesRef.current))
              continue;
            const s = worldToScreen(calNow, w, h, view.current, st.x, st.y);
            if (hitTextLabel(ctx, st, s, x, y)) {
              beginEditingRef.current({
                index: i,
                x: st.x,
                y: st.y,
                sx: s.x,
                sy: s.y,
                text: st.text,
                color: st.color,
                round: st.round,
                start_tick: st.start_tick,
                end_tick: st.end_tick,
              });
              return;
            }
          }
        }
        const next: TextEdit = {
          index: null,
          x: world.x,
          y: world.y,
          sx: x,
          sy: y,
          text: "",
          color: colorRef.current,
          round: roundNow,
        };
        const stamped = withMoment(
          { type: "text", round: roundNow, color: next.color, x: next.x, y: next.y, text: "" },
          momentRef.current,
          tickNow,
          rnd?.end_tick ?? 0,
          tps,
        );
        if (stamped.start_tick != null) {
          next.start_tick = stamped.start_tick;
          next.end_tick = stamped.end_tick;
        }
        beginEditingRef.current(next);
        return;
      }

      if (toolNow === "pen" || toolNow === "arrow") {
        if (!calNow) return;
        view.current.drawing = true;
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const base: Stroke =
          toolNow === "pen"
            ? { type: "pen", color: colorRef.current, round: roundNow, points: [world] }
            : { type: "arrow", color: colorRef.current, round: roundNow, from: world, to: world };
        draft.current = withMoment(base, momentRef.current, tickNow, rnd?.end_tick ?? 0, tps);
        penTip.current = toolNow === "pen" ? world : null;
        return;
      }

      view.current.dragging = true;
      view.current.dragged = false;
      view.current.lx = e.clientX;
      view.current.ly = e.clientY;
    };

    const onMove = (e: MouseEvent) => {
      const calNow = calRef.current;
      if (view.current.drawing && draft.current && calNow) {
        const wrapEl = wrapRef.current;
        if (!wrapEl) return;
        const { x, y } = pos(e);
        const world = screenToWorld(
          calNow,
          wrapEl.clientWidth,
          wrapEl.clientHeight,
          view.current,
          x,
          y,
        );
        if (draft.current.type === "pen") {
          penTip.current = world;
          const last = draft.current.points[draft.current.points.length - 1];
          if (Math.hypot(world.x - last.x, world.y - last.y) >= PEN_MIN_SAMPLE_DISTANCE) {
            draft.current.points.push(world);
          }
        } else if (draft.current.type === "arrow") {
          draft.current.to = world;
        }
        return;
      }
      if (!view.current.dragging) return;
      const dx = e.clientX - view.current.lx;
      const dy = e.clientY - view.current.ly;
      if (!view.current.dragged && dx * dx + dy * dy < 16) return;
      if (!view.current.dragged) {
        view.current.dragged = true;
        onPanRef.current();
      }
      view.current.ox += dx;
      view.current.oy += dy;
      view.current.lx = e.clientX;
      view.current.ly = e.clientY;
    };

    const onUp = () => {
      if (view.current.drawing && draft.current) {
        let st = draft.current;
        if (st.type === "pen") {
          const tip = penTip.current;
          if (tip) {
            const last = st.points[st.points.length - 1];
            if (Math.hypot(tip.x - last.x, tip.y - last.y) > 0) st.points.push(tip);
          }
          if (st.points.length < 2) {
            draft.current = null;
            penTip.current = null;
            view.current.drawing = false;
            return;
          }
          st = { ...st, points: simplifyStroke(st.points) };
        } else if (st.type !== "arrow") {
          draft.current = null;
          penTip.current = null;
          view.current.drawing = false;
          return;
        }
        onStrokesRef.current([...strokesRef.current, st]);
        draft.current = null;
        penTip.current = null;
      }
      view.current.drawing = false;
      view.current.dragging = false;
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
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
    let best: { i: number; d: number } | null = null;
    for (const p of players) {
      if (!p.present) continue;
      const s = worldToScreen(calNow, w, h, view.current, p.x, p.y);
      const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
      if (!best || d < best.d) best = { i: p.index, d };
    }
    onSelectRef.current(best && best.d < 18 * 18 ? best.i : null);
  };

  const cursor = tool === "pan" ? "grab" : tool === "eraser" ? "cell" : "crosshair";

  const onTextKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      editingRef.current = null;
      setEditing(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEditing();
    }
  };

  return (
    <div className="radar-wrap" ref={wrapRef} style={{ cursor }}>
      <canvas ref={canvasRef} onClick={onClick} />
      {editing && (
        <textarea
          ref={editAreaRef}
          className="radar-text-edit"
          value={editing.text}
          placeholder="Note"
          rows={2}
          autoFocus
          style={{ left: editing.sx, top: editing.sy }}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const next = { ...editing, text: e.target.value };
            editingRef.current = next;
            setEditing(next);
          }}
          onKeyDown={onTextKeyDown}
          onBlur={() => {
            if (ignoreBlurRef.current) {
              focusEditor();
              return;
            }
            commitEditing();
          }}
        />
      )}
    </div>
  );
}

function hitStroke(st: Stroke, x: number, y: number, maxDist: number): boolean {
  if (st.type === "text") return false;
  const d2 = maxDist * maxDist;
  if (st.type === "pen") {
    return st.points.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < d2);
  }
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = st.from.x + (st.to.x - st.from.x) * t;
    const py = st.from.y + (st.to.y - st.from.y) * t;
    if ((px - x) ** 2 + (py - y) ** 2 < d2) return true;
  }
  return false;
}
