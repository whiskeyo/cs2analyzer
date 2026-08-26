import { NOTE_TEXT_MAX_WIDTH } from "../constants";
import { worldToScreen, type RadarView } from "../maps";
import { overlayVisible } from "../overlay";
import type { MapCalibration, Stroke } from "../types";

export function yawToCanvas(yaw: number): number {
  // CS2 eye yaw 0 is +X, but the pawn forward used on radar is 180° from that.
  return ((-yaw + 180) * Math.PI) / 180;
}

export function drawC4(
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

export function drawHeBurst(
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

export function grenadePosAt(
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

export function drawCurvedArrow(
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

function textWrapWidth(st: Extract<Stroke, { type: "text" }>): number {
  if (st.box_w == null) return NOTE_TEXT_MAX_WIDTH;
  return Math.max(1, st.box_w - TEXT_PAD * 2);
}

function textBox(
  ctx: CanvasRenderingContext2D,
  st: Extract<Stroke, { type: "text" }>,
  screen: { x: number; y: number },
): { x: number; y: number; w: number; h: number; lines: string[] } {
  ctx.font = TEXT_FONT;
  const wrapW = textWrapWidth(st);
  const lines = wrapNote(ctx, st.text, wrapW);
  let inner = 24;
  for (const line of lines) {
    inner = Math.max(inner, ctx.measureText(line || " ").width);
  }
  const contentW = Math.min(wrapW, inner) + TEXT_PAD * 2;
  const contentH = Math.max(1, lines.length) * TEXT_LINE + TEXT_PAD * 2;
  const w = st.box_w ?? contentW;
  const h = st.box_h ?? contentH;
  return { x: screen.x - w / 2, y: screen.y - h / 2, w, h, lines };
}

export function drawTextLabel(
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
  ctx.clip();
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

export function hitTextLabel(
  ctx: CanvasRenderingContext2D,
  st: Extract<Stroke, { type: "text" }>,
  screen: { x: number; y: number },
  mx: number,
  my: number,
): boolean {
  const box = textBox(ctx, st, screen);
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

export function findTextIndex(
  ctx: CanvasRenderingContext2D,
  cal: MapCalibration,
  w: number,
  h: number,
  view: RadarView,
  strokes: Stroke[],
  tick: number,
  round: number,
  mx: number,
  my: number,
): number {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const st = strokes[i];
    if (st.type !== "text" || !overlayVisible(st, tick, round, strokes)) continue;
    const s = worldToScreen(cal, w, h, view, st.x, st.y);
    if (hitTextLabel(ctx, st, s, mx, my)) return i;
  }
  return -1;
}

export function hitStroke(st: Stroke, x: number, y: number, maxDist: number): boolean {
  if (st.type === "text" || st.type === "bookmark") return false;
  const d2 = maxDist * maxDist;
  if (st.type === "pen") {
    return st.points.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < d2);
  }
  if (st.type !== "arrow") return false;
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = st.from.x + (st.to.x - st.from.x) * t;
    const py = st.from.y + (st.to.y - st.from.y) * t;
    if ((px - x) ** 2 + (py - y) ** 2 < d2) return true;
  }
  return false;
}
