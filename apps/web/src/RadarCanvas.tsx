import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { tickRate } from "./constants";
import { radarFloor, radarUrl, screenToWorld, worldToScreen, type RadarView } from "./maps";
import { publicUrl } from "./publicUrl";
import {
  blindsAt,
  firesAt,
  HIT_SECONDS,
  hitsAt,
  killLineEnds,
  lingerRemaining,
  nadeLandPos,
  nadePopTick,
  nadeVisibleEnd,
  nadesForSummary,
  NADE_COLORS,
  TRACER_SECONDS,
} from "./radarFx";
import { currentRound, samplePlayers, sampleTrail } from "./sample";
import { activeBomb } from "./stats";
import type { DrawTool, MapCalibration, MapLayers, Replay, Stroke } from "./types";

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
  layers: MapLayers;
  viewEpoch: number;
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
  layers,
  viewEpoch,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
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
  const layersRef = useRef(layers);
  layersRef.current = layers;
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
  const c4Icon = useRef<HTMLImageElement | null>(null);

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

      const useLower = radarFloor(calNow, players, selectedRef.current) === "lower";
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
        for (const g of nadesForSummary(replay)) {
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
          const burst =
            tickNow >= popAt &&
            tickNow <= popAt + ticksPerSecond * 0.35 &&
            tickNow <= visibleEnd &&
            (g.kind === "he" || g.kind === "flash");

          if (inFlight) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
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
              ctx.globalAlpha = 1;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.stroke();
            }
          } else if (lingering || burst) {
            const occupancy =
              g.kind === "molotov" ? g.fires : g.kind === "smoke" ? g.voxels : undefined;
            const cells =
              g.kind === "molotov"
                ? firesAt(g.fires, tickNow)
                : g.kind === "smoke"
                  ? firesAt(g.voxels, tickNow)
                  : [];
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
              if (g.kind === "smoke") {
                const radius = 32 * Math.min(1.4, v.scale);
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.22;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();
              }
              const cellR = (g.kind === "smoke" ? 6 : 8) * Math.min(1.4, v.scale);
              ctx.fillStyle = color;
              ctx.globalAlpha = g.kind === "smoke" ? 0.32 : 0.42;
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
              // Occupancy was sampled but none is live — don't keep the envelope circle.
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

      const drawStroke = (st: Stroke, alpha = 1) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = st.color;
        ctx.fillStyle = st.color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        if (st.type === "pen") {
          ctx.beginPath();
          st.points.forEach((pt, i) => {
            const s = toScreen(pt.x, pt.y);
            if (i === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
        } else {
          const a = toScreen(st.from.x, st.from.y);
          const b = toScreen(st.to.x, st.to.y);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - 12 * Math.cos(ang - 0.4), b.y - 12 * Math.sin(ang - 0.4));
          ctx.lineTo(b.x - 12 * Math.cos(ang + 0.4), b.y - 12 * Math.sin(ang + 0.4));
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      for (const st of strokesRef.current) drawStroke(st);
      if (draft.current) drawStroke(draft.current, 0.7);

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
      const calNow = calRef.current;
      const { x, y } = pos(e);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const toolNow = toolRef.current;

      if (toolNow === "eraser" && calNow) {
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        const next = strokesRef.current.filter((st) => !hitStroke(st, world.x, world.y, 48));
        onStrokesRef.current(next);
        return;
      }

      if (toolNow === "pen" || toolNow === "arrow") {
        if (!calNow) return;
        view.current.drawing = true;
        const world = screenToWorld(calNow, w, h, view.current, x, y);
        draft.current =
          toolNow === "pen"
            ? { type: "pen", color: colorRef.current, points: [world] }
            : { type: "arrow", color: colorRef.current, from: world, to: world };
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
          draft.current.points.push(world);
        } else {
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
        onStrokesRef.current([...strokesRef.current, draft.current]);
        draft.current = null;
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

  return (
    <div className="radar-wrap" ref={wrapRef} style={{ cursor }}>
      <canvas ref={canvasRef} onClick={onClick} />
    </div>
  );
}

function hitStroke(st: Stroke, x: number, y: number, maxDist: number): boolean {
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
