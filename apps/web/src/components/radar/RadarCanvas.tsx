import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { tickRate } from "@/lib/shared/constants";
import { radarFloor, radarUrl, worldToScreen } from "@/lib/radar/maps";
import { overlayVisible } from "@/lib/notes";
import { publicUrl } from "@/lib/shared/publicUrl";
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
  TRACER_SECONDS,
} from "@/lib/radar/radarFx";
import {
  drawArrow,
  drawC4,
  drawHeBurst,
  drawTextLabel,
  grenadePosAt,
  yawToCanvas,
} from "@/lib/radar/draw";
import { TextNoteEditor, useTextNotes, type TextMove } from "@/components/radar/TextNoteEditor";
import { useRadarPointer, type RadarPanView } from "@/lib/radar/useRadarPointer";
import { currentRound, samplePlayers, sampleTrail } from "@/lib/replay/sample";
import { activeBomb } from "@/lib/stats/stats";
import { drawSmoothLine, simplifyStroke } from "@/lib/radar/strokes";
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
              const color = line.ct ? "#5b9fd6" : "#ffd24a";
              ctx.globalAlpha = 1;
              drawArrow(ctx, from, to, color, 3.2);
              ctx.fillStyle = color;
              ctx.strokeStyle = "#12181f";
              ctx.lineWidth = 3;
              ctx.font = "bold 11px ui-sans-serif, system-ui";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.strokeText("FK", from.x, from.y - 8);
              ctx.fillText("FK", from.x, from.y - 8);
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
        if (st.type === "bookmark") return;
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
          drawArrow(ctx, a, b, st.color, 3.2);
        }
        ctx.globalAlpha = 1;
      };
      const roundNow = currentRound(replay, tickRef.current)?.number ?? 0;
      const tickDraw = tickRef.current;
      const skipText = editingRef.current?.index;
      const moving = textMoveRef.current;
      strokesRef.current.forEach((st, i) => {
        if (!overlayVisible(st, tickDraw, roundNow, strokesRef.current)) return;
        if (st.type === "text" && skipText === i) return;
        if (st.type === "text" && moving && moving.index === i && moving.moved) {
          drawStroke({ ...st, x: moving.x, y: moving.y });
          return;
        }
        drawStroke(st);
      });
      if (draft.current && overlayVisible(draft.current, tickDraw, roundNow, strokesRef.current)) {
        drawStroke(draft.current, 0.85, true);
      }
      const ed = editingRef.current;
      const wrapBox = editWrapRef.current;
      if (ed && wrapBox && calNow) {
        const s = toScreen(ed.x, ed.y);
        wrapBox.style.left = `${s.x}px`;
        wrapBox.style.top = `${s.y}px`;
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
    let best: { i: number; d: number } | null = null;
    for (const p of players) {
      if (!p.present) continue;
      const s = worldToScreen(calNow, w, h, view.current, p.x, p.y);
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
